import pandas as pd
import os

def create_guitar_notes_data():
    # Initialize empty list to store all notes
    all_notes = []
    
    # Guitar strings data
    guitar_strings = {
        6: {'name': 'High E', 'notes': [
            ('E', 330), ('F', 349), ('F#', 370), ('G', 392), ('G#', 415),
            ('A', 440), ('A#', 466), ('B', 494), ('C', 523), ('C#', 554),
            ('D', 587), ('D#', 622), ('E', 659)
        ]},
        5: {'name': 'B', 'notes': [
            ('B', 247), ('C', 262), ('C#', 278), ('D', 294), ('D#', 311),
            ('E', 330), ('F', 349), ('F#', 370), ('G', 392), ('G#', 415),
            ('A', 440), ('A#', 466), ('B', 494)
        ]},
        4: {'name': 'G', 'notes': [
            ('G', 196), ('G#', 208), ('A', 220), ('A#', 233), ('B', 247),
            ('C', 262), ('C#', 278), ('D', 294), ('D#', 311), ('E', 330),
            ('F', 349), ('F#', 370), ('G', 392)
        ]},
        3: {'name': 'D', 'notes': [
            ('D', 147), ('D#', 156), ('E', 165), ('F', 175), ('F#', 185),
            ('G', 196), ('G#', 208), ('A', 220), ('A#', 233), ('B', 247),
            ('C', 262), ('C#', 278), ('D', 294)
        ]},
        2: {'name': 'A', 'notes': [
            ('A', 110), ('A#', 117), ('B', 124), ('C', 131), ('C#', 139),
            ('D', 147), ('D#', 156), ('E', 165), ('F', 175), ('F#', 185),
            ('G', 196), ('G#', 208), ('A', 220)
        ]},
        1: {'name': 'Low E', 'notes': [
            ('E', 82), ('F', 87), ('F#', 93), ('G', 98), ('G#', 104),
            ('A', 110), ('A#', 117), ('B', 124), ('C', 131), ('C#', 139),
            ('D', 147), ('D#', 156), ('E', 165)
        ]}
    }
    
    # Create records for each note
    for string_num, string_data in guitar_strings.items():
        for fret, (note, frequency) in enumerate(string_data['notes']):
            all_notes.append({
                'string': string_num,
                'string_name': string_data['name'],
                'fret': fret,
                'note': note,
                'frequency': frequency
            })
    
    # Create DataFrame
    df = pd.DataFrame(all_notes)
    
    # Create output directory if it doesn't exist
    output_dir = os.path.join(os.path.dirname(__file__), '../data')
    os.makedirs(output_dir, exist_ok=True)
    
    # Save to CSV
    output_path = os.path.join(output_dir, 'guitar_notes.csv')
    df.to_csv(output_path, index=False)
    print(f"Guitar notes data saved to {output_path}")
    
    return df

if __name__ == "__main__":
    df = create_guitar_notes_data()
    print("\nFirst few rows of the created dataset:")
    print(df.head())
