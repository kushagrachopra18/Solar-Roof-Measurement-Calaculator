import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  GoogleMap,
  Marker,
  DirectionsRenderer,
  Circle,
  MarkerClusterer,
  Polyline,
  Polygon,
  DrawingManager,
  useGoogleMap,
} from "@react-google-maps/api";
import Places from "./places";
import { unmountComponentAtNode } from "react-dom";
import React from "react";
// import Distance from "./distance";

type LatLngLiteral = google.maps.LatLngLiteral;
type MapOptions = google.maps.MapOptions;

export default function Map() {
    const [energyConsumption, setEnergyConsumption] = useState<number>(900); //in kWh
    const solarPanelWidth: number = 3.5; //in ft
    const solarPanelHeight: number = 5; //in ft
    const solarPanelArea: number = solarPanelWidth * solarPanelHeight; //in sq ft
    const solarPanelEnergyOutput: number = 48; //in kWh

    
    const [zoom, setZoom] = useState<number>(12);
    const [panelHovering, setPanelHovering] = useState<number>();
    
    const [home, setHome] = useState<LatLngLiteral>();
    useEffect(() => {
        if(home){
            setZoom(100);
        }
      }, [home]);

    const mapRef = useRef<google.maps.Map>();
    const center = useMemo<LatLngLiteral>(() => ({lat: 29.425319, lng: -98.492733}), []);

    const options = useMemo<MapOptions>(() => ({
        mapId: "793ef8405dde11b1",
        disableDefaultUI: true,
        clickableIcons: false,
        rotateControl: false,
        tilt: 0,
        mapTypeId: 'hybrid',
        draggableCursor: 'crosshair',
    }), []);
    const onLoad = useCallback((map: google.maps.Map) => (mapRef.current = map), []);

    const dotIcon = {
        url: "https://www.wsfcu.com/wp-content/uploads/Decorative-Orange-Box-Slider.jpg",
        scaledSize: new google.maps.Size(10, 10), // scaled size
        origin: new google.maps.Point(0,0), // origin
        anchor: new google.maps.Point(5, 5) // anchor
    }; 

    //Handle creating and drawing the current Polyline

    const [boxPoints, setBoxPoints] = useState<LatLngLiteral[]>([]);
    const currPolyline = useRef<google.maps.Polyline>();

    let addBoxPoint = (coordinates: LatLngLiteral) => {
        setBoxPoints([...boxPoints, coordinates]);
    };

    useEffect(() => {
        if(boxPoints.length >= 2){
            if(currPolyline.current !== undefined){
                currPolyline.current.setMap(null);
            }
            const newPolyline = new google.maps.Polyline({
                path: boxPoints,
                geodesic: false,
                strokeColor: "#FF0000",
            });
            newPolyline.setMap(mapRef.current!);
            // newPolyline.addListener('click', () => {newPolyline.setMap(null);})
            currPolyline.current = newPolyline;            
        } else {
            if(currPolyline.current !== undefined){
                currPolyline.current.setMap(null);
            }
        }
    });

    // Handle creating and drawing the panel Polygons

    const[roofPanels, setRoofPanels] = useState<roofPanel[]>([]);
    const[deletedPanels, setDeletedPanels] = useState<number[]>([]);

    enum CardinalDirection{
        north,
        south,
        east,
        west
    }
    function drawPoint(points: LatLngLiteral | google.maps.LatLng){
        const point = new google.maps.Marker({
            position: points,
            icon: dotIcon
        });
        point.setMap(mapRef.current!);
    }

    class roofPanel{
        isDeleted: boolean = false;
        points: LatLngLiteral[];
        panel: google.maps.Polygon;
        area: number;
        index: number;
        solarPanels: google.maps.Polygon[] = [];

        constructor(points: LatLngLiteral[], index: number){
            const panel = new google.maps.Polygon({
                paths: points,
                strokeColor: "#FF0000",
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: "#FF0000",
                fillOpacity: 0.35,
            });
            panel.setMap(mapRef.current!);
            panel.addListener('click', () => {
                this.delete();
            });
            panel.addListener('mouseover', () => {setPanelHovering(index);});
            panel.addListener('mouseout', () => {setPanelHovering(undefined);});

            this.area = google.maps.geometry.spherical.computeArea(points) * 10.7639; //convert square meters to sqaure feet
            this.index = index;
            this.points = points;
            this.panel = panel;

            //Draw solar panels
            switch (points.length) {
                case 3: //If triangle
                    this.drawSolarPanelsInTriangle(points);         
                default:
                    break;
            }
        }

        private drawSolarPanelsInTriangle(points:LatLngLiteral[]): boolean{
            //1. Identify side with largest vertical component----------------------------------
            let yComponentLengths:number[][] = [];

            points.forEach((point, index) => {
                yComponentLengths.push([]);
                points.map((otherPoint) => {
                    yComponentLengths[index].push(Math.abs(point.lat -  otherPoint.lat));
                });
            });

            let maxVal = 0;
            let maxLine: LatLngLiteral[] = [{lat:0, lng:0}, {lat:0, lng:0}];

            for(let r = 0; r < yComponentLengths.length; r++){
                for(let c = 0; c < yComponentLengths.length; c++){
                    if(yComponentLengths[r][c] > maxVal){
                        maxVal = yComponentLengths[r][c];
                        maxLine[0] = points[r];
                        maxLine[1] = points[c];
                    }
                }
            }

            //Draws blue line over side with largest y component (for debugging)
            // const maxLineDrawing = new google.maps.Polyline({
            //     path: maxLine,
            //     geodesic: false,
            //     strokeColor: "#0000FF",
            // });
            // maxLineDrawing.setMap(mapRef.current!);

            //2. Identify nothmost point on line----------------------------------
            let northMost: LatLngLiteral;
            let southMost: LatLngLiteral;
            if(maxLine[0].lat > maxLine[1].lat){
                northMost = maxLine[0];
                southMost = maxLine[1];
            }else{
                northMost = maxLine[1];
                southMost = maxLine[0];
            }

            //Draws a massive "north symbol" at the nothernmost point of the side with largest y component (for debugging)
            // const northPointDrawing = new google.maps.Marker({
            //     position: northMost,
            //     icon: "data:image/png;base64,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"
            // });
            // northPointDrawing.setMap(mapRef.current);

            // 3. Identify if rest of triangle is on left or right of line----------------------------------

            //Draws a draws a "dotIcon" at the point that 1 solar panel height below the northmost point the side with largest y component (for debugging)
            // let temp = northMost;
            // temp.lat = temp.lat - (solarPanelHeight/3280.4/(10000/90));
            // const onePanelHeightDown = new google.maps.Marker({
            //     position: temp,
            //     icon: dotIcon
            // });
            // onePanelHeightDown.setMap(mapRef.current);
            
            let maxLineHeading = google.maps.geometry.spherical.computeHeading(northMost, southMost);
            let solarPanelDistanceOnLine = Math.abs((solarPanelHeight * 0.3048)/(Math.cos(((180-Math.abs(maxLineHeading))*(Math.PI/180))))); //in meters
            let currPointOnMaxLine = google.maps.geometry.spherical.computeOffset(northMost, solarPanelDistanceOnLine, maxLineHeading);

            //Draws a "dotIcon" at the point on the side with largest y component at the point that corresponds to the latitude of "onePanelHeightDown"
            //  *Note: This method is buggy, seems like due to some issues on Google Maps's side of things
            //      -Tied:
            //          -Deriving and using formula of line
            //          -Using the interpolate function 
            // const onePanelHeightDownOnLine = new google.maps.Marker({
            //     position: currPointOnMaxLine,
            //     icon: dotIcon
            // });
            // onePanelHeightDownOnLine.setMap(mapRef.current);

            let westOfCurrPointOnMaxLine = google.maps.geometry.spherical.computeOffset(currPointOnMaxLine, (solarPanelWidth * 0.3048), 270);
            let eastOfCurrPointOnMaxLine = google.maps.geometry.spherical.computeOffset(currPointOnMaxLine, (solarPanelWidth * 0.3048), 90);

            let canDrawPanels = true;
            if(google.maps.geometry.poly.containsLocation(westOfCurrPointOnMaxLine, this.panel)){
                while(canDrawPanels){
                    this.drawRowOfPanels(currPointOnMaxLine, CardinalDirection.west);
                    let southPointOfNextPanel = google.maps.geometry.spherical.computeOffset(currPointOnMaxLine, (2 * solarPanelHeight * 0.3048), 180);
                    if(southPointOfNextPanel.lat() - southMost.lat < 0){
                        canDrawPanels = false;
                    }
                    currPointOnMaxLine = google.maps.geometry.spherical.computeOffset(currPointOnMaxLine, solarPanelDistanceOnLine, maxLineHeading);
                }
            }else if(google.maps.geometry.poly.containsLocation(eastOfCurrPointOnMaxLine, this.panel)){
                while(canDrawPanels){
                    this.drawRowOfPanels(currPointOnMaxLine, CardinalDirection.east);
                    let southPointOfNextPanel = google.maps.geometry.spherical.computeOffset(currPointOnMaxLine, (2 * solarPanelHeight * 0.3048), 180);
                    if(southPointOfNextPanel.lat() - southMost.lat < 0){
                        canDrawPanels = false;
                    }
                    currPointOnMaxLine = google.maps.geometry.spherical.computeOffset(currPointOnMaxLine, solarPanelDistanceOnLine, maxLineHeading);
                }
            }

            //4. Draw as many solar panels as possible to the left or right----------------------------------

            //5. Go down 1 row and repeat Step 4 if you are not below the latitude of the southmost point of the longest side, if you can't then terminate----------------------------------

            return true;
        }

        private getLngOnLine(startPoint: LatLngLiteral, endPoint: LatLngLiteral, targetLat: number): number{
            return (targetLat - startPoint.lat)*((endPoint.lng-startPoint.lng)/(endPoint.lat-startPoint.lat))+startPoint.lng;
        }

        private drawRowOfPanels(origin:LatLngLiteral|google.maps.LatLng, direction:CardinalDirection){
            switch (direction) {
                case CardinalDirection.west:
                    let topLeftPointWest = google.maps.geometry.spherical.computeOffset(origin, (solarPanelWidth * 0.3048), 270);
                    let bottomRightPointWest = google.maps.geometry.spherical.computeOffset(origin, (solarPanelHeight * 0.3048), 180);
                    let bottomLeftPointWest = google.maps.geometry.spherical.computeOffset(bottomRightPointWest, (solarPanelWidth * 0.3048), 270);
                    let solarPanelVerteciesWest = [origin, topLeftPointWest, bottomLeftPointWest, bottomRightPointWest];

                    let fullyWithinRoofPanelWest = true;
                    let anyPointWithinRoofPanelWest = false;
                    solarPanelVerteciesWest.map((vertex) => {
                        if(!google.maps.geometry.poly.containsLocation(vertex, this.panel)){
                            fullyWithinRoofPanelWest = false;
                        }else{
                            anyPointWithinRoofPanelWest = true;
                        }
                    });

                    if(fullyWithinRoofPanelWest){
                        let newSolarPanel = new google.maps.Polygon({
                            paths: solarPanelVerteciesWest,
                            strokeColor: "#00FF00",
                            strokeOpacity: 0.8,
                            strokeWeight: 2,
                            fillColor: "#00FF00",
                            fillOpacity: 0.35,
                        });
                        newSolarPanel.addListener('click', () => {
                            this.delete();
                        });
                        newSolarPanel.addListener('mouseover', () => {setPanelHovering(this.index);});
                        newSolarPanel.addListener('mouseout', () => {setPanelHovering(undefined);});
                        this.solarPanels.push(newSolarPanel);
                        this.solarPanels[this.solarPanels.length-1].setMap(mapRef.current!);
                    }

                    if(anyPointWithinRoofPanelWest){
                        this.drawRowOfPanels(topLeftPointWest, CardinalDirection.west);
                    }
                    break;
                case CardinalDirection.east:
                    let topRightPointEast = google.maps.geometry.spherical.computeOffset(origin, (solarPanelWidth * 0.3048), 90);
                    let bottomLeftPointEast = google.maps.geometry.spherical.computeOffset(origin, (solarPanelHeight * 0.3048), 180);
                    let bottomRightPointEast = google.maps.geometry.spherical.computeOffset(bottomLeftPointEast, (solarPanelWidth * 0.3048), 90);
                    let solarPanelVerteciesEast = [origin, topRightPointEast, bottomRightPointEast, bottomLeftPointEast];

                    let fullyWithinRoofPanelEast = true;
                    let anyPointWithinRoofPanelEast = false;
                    solarPanelVerteciesEast.map((vertex) => {
                        if(!google.maps.geometry.poly.containsLocation(vertex, this.panel)){
                            fullyWithinRoofPanelEast = false;
                        }else{
                            anyPointWithinRoofPanelEast = true;
                        }
                    });

                    if(fullyWithinRoofPanelEast){
                        let newSolarPanel = new google.maps.Polygon({
                            paths: solarPanelVerteciesEast,
                            strokeColor: "#00FF00",
                            strokeOpacity: 0.8,
                            strokeWeight: 2,
                            fillColor: "#00FF00",
                            fillOpacity: 0.35,
                        });
                        newSolarPanel.addListener('click', () => {
                            this.delete();
                        });
                        newSolarPanel.addListener('mouseover', () => {setPanelHovering(this.index);});
                        newSolarPanel.addListener('mouseout', () => {setPanelHovering(undefined);});
                        this.solarPanels.push(newSolarPanel);
                        this.solarPanels[this.solarPanels.length-1].setMap(mapRef.current!);
                    }

                    if(anyPointWithinRoofPanelEast){
                        this.drawRowOfPanels(topRightPointEast, CardinalDirection.east);
                    }
                    break;
                default:
                    break;
            }
        }
        

        delete(){
            this.isDeleted = true;
            this.panel.setMap(null);
            this.solarPanels.map((panel) => {
                panel.setMap(null);
            });
            setDeletedPanels(deletedPanels => [...deletedPanels, this.index]);
        }

        addBack(){
            this.isDeleted = false;
            this.panel.setMap(mapRef.current!);
            this.solarPanels.map((panel) => {
                panel.setMap(mapRef.current!);
            });
            setDeletedPanels(deletedPanels => deletedPanels.filter(item => item !== this.index));
        }
    };
    
    let addRoofSegmment = (points: LatLngLiteral[]) => {
        let index = roofPanels.length;
        setRoofPanels([...roofPanels, new roofPanel(points, index)]);
    };

    let getRoofArea = () => {
        let area = 0;
        roofPanels.forEach((panel) => {
            if(!panel.isDeleted){
                area += panel.area;
            }
        });

        return area;
    }
    

    return( 
        <div className="container">
            <div className="controls">
                <h1>Solar Roof Measurement Calculator</h1>
                <p>Figure out how many solar panels you can fit on your roof.</p>
                <Places 
                    setHome={(position) => {
                        setHome(position);
                        mapRef.current?.panTo(position);
                    }}
                />
                <hr />
                <h1 style={{'fontSize': '25px',}}>Drawn Panels</h1>
                <p style={{'fontSize': '12px', 'color': 'lightgray', 'margin': "0  0 15px 0"}}>Draw polygons over all south, east and west facing sections of your roof.</p>
                {deletedPanels.length > 0 && <div className="deleted_panels_outer_container">
                    <p className="deleted_panels_description">Click to add panel back:</p>
                    <div className="deleted_panels_inner_container">
                        {deletedPanels && deletedPanels.map((panelIndex) => {
                            return <button key={panelIndex} className="deleted_panels_button" onClick={(e) => {
                                roofPanels[panelIndex].addBack();
                            }}>{panelIndex+1}</button>
                        })}
                    </div>
                </div>}
                {deletedPanels && roofPanels.length>0 && roofPanels.map((panel, index) => {
                    if(!panel.isDeleted){
                        let area = panel.area;
                        return (
                            <div className="roof_panel_info_box">
                                <h1>Panel {index+1}</h1>
                                <p>Area: <span className="bold">{area.toFixed(2)} ft²</span></p>
                                {panel.points.length === 3 && <p>Panels: <span className="bold">{panel.solarPanels.length} solar panels</span></p>}
                                <button 
                                    className="delete_button"
                                    onClick={(e) => {
                                        panel.delete();
                                    }}
                                >
                                    Delete
                                </button>
                            </div>
                        );
                    }else{
                        return (<></>);
                    }
                })}
                <div className="summary">
                    <hr />
                    <h1>Summary</h1>
                    <p>Total Area: <span className="bold">{getRoofArea().toFixed(2)} ft² </span></p>
                        <p style={{'fontSize': '12px', 'color': 'lightgray'}}>Ender your home's average monthly energy consumption below:</p>
                        <div style={{
                            'width': '100%',
                            'display': 'flex'
                        }}>
                            <input
                                value={energyConsumption}
                                onChange={(e) => {
                                    setEnergyConsumption(Number(e.target.value))
                                }}
                                className="combobox-input"
                                placeholder="Energy consumption"
                                style={{
                                    'width': '25%',
                                    'minWidth': '50px',
                                    'margin': '5px 10px 5px 0',
                                    'borderRadius': '2px',
                                    'textAlign': 'center'
                                }}
                            />
                            <p>kWh per month</p>
                        </div>
                    <p>
                        You can offset <span className="bold">{(getRoofArea()/solarPanelArea*solarPanelEnergyOutput/energyConsumption*100).toFixed(0)}%</span> of 
                        your home's energy using <span className="bold">{(getRoofArea()/solarPanelArea).toFixed(0)} solar panels</span> solar panels which 
                        will generate <span className="bold">{(getRoofArea()/solarPanelArea*solarPanelEnergyOutput).toFixed(2)} kWh</span> of energy 
                        per month.
                    </p>
                </div>
            </div>
            <div className="map">
                {panelHovering !== undefined && <div className="hovering_over_message">Currently hovering over: <span style={{'fontSize':'25px'}}>Panel {panelHovering+1}</span></div>}
                <GoogleMap 
                    zoom={zoom}
                    center={center}
                    mapContainerClassName="map-container"
                    options={options}
                    onLoad={onLoad}
                    onClick={(e) => {
                        addBoxPoint(e.latLng?.toJSON()!);
                    }}
                >
                    {boxPoints.length > 0 && boxPoints.map((coordinates, index) => (
                            <Marker
                            key={index}
                            position={coordinates}
                            icon={dotIcon}
                            onClick={(e) => {
                                if(index === 0 && boxPoints.length >= 3){
                                    addRoofSegmment(boxPoints);
                                    setBoxPoints([]);
                                }
                            }}
                            />
                    ))}
                    {home && <Marker position={home} icon=""/>}
                </GoogleMap>
            </div>
        </div>
    );
}