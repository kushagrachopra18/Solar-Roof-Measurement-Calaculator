import usePlacesAutocomplete, {
    getGeocode,
    getLatLng,
} from "use-places-autocomplete";
import {
    Combobox,
    ComboboxInput,
    ComboboxPopover,
    ComboboxList,
    ComboboxOption,
} from "@reach/combobox";
import "@reach/combobox/styles.css";

type PlacesProps = {
    setHome: (position: google.maps.LatLngLiteral) => void;
};

export default function Places({ setHome }: PlacesProps) {
    const {ready, value, setValue, suggestions: {status, data}, clearSuggestions} = usePlacesAutocomplete();

    const handleSelect = async (val: string) => {
        setValue(val, false);
        clearSuggestions();

        const results = await getGeocode({address: val});
        const {lat, lng} = await getLatLng(results[0]);
        setHome({lat, lng});
    };

    return( 
        <Combobox onSelect={handleSelect}>
            <div style={{
                'width': '100%',
                'display': 'flex'
            }}>
                <p>🔍</p>
                <ComboboxInput
                    value={value}
                    onChange={(e) => {
                        setValue(e.target.value)
                    }}
                    disabled={!ready}
                    className="combobox-input"
                    placeholder="Search home address"
                    style={{
                        'width': '100%',
                        'margin': '10px',
                        'borderRadius': '2px'
                    }}
                />
            </div>
            <ComboboxPopover>
                <ComboboxList>
                    {status === "OK" && data.map(({place_id, description}) => (
                        <ComboboxOption
                            key={place_id}
                            value={description}
                        />
                    ))}
                </ComboboxList>
            </ComboboxPopover>
        </Combobox>
    );
}