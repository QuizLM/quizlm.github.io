import json
import csv

# --- Configuration (कॉन्फ़िगरेशन) ---
# अपनी JSON फ़ाइल का नाम यहाँ बदलें
JSON_FILE_PATH = 'questions.json' 
# यह CSV फ़ाइल बनाएगा
CSV_FILE_PATH = 'questions_for_supabase.csv' 
# --- End Configuration (कॉन्फ़िगरेशन समाप्त) ---

def format_pg_array_correctly(py_list):
    """
    Python list को Supabase CSV Importer के लिए required format 
    (e.g., {"item1","item2"}) में बदलता है।
    """
    if not py_list:
        return "{}"
    
    formatted_list = []
    for item in py_list:
        # 1. आइटम को स्ट्रिंग में बदलें
        item_str = str(item)
        # 2. आइटम के अंदर मौजूद double quotes को escape करें (e.g., " becomes "")
        # PostgreSQL standard escaping for strings inside arrays
        item_str = item_str.replace('\\', '\\\\').replace('"', '\\"')
        # 3. CORRECTED LOGIC: हर आइटम को double quotes में wrap (रैप) करें
        formatted_list.append(f'"{item_str}"')
        
    return "{" + ",".join(formatted_list) + "}"

print(f"Starting conversion of {JSON_FILE_PATH} with CORRECTED script...")

try:
    with open(JSON_FILE_PATH, 'r', encoding='utf-8') as f_in, \
         open(CSV_FILE_PATH, 'w', encoding='utf-8-sig', newline='') as f_out:

        questions_data = json.load(f_in)
        
        header = [
            'v1_id', 'subject', 'topic', 'subTopic', 'examName', 'examYear','examDateShift',
            'difficulty', 'questionType', 'question', 'question_hi',
            'options', 'options_hi', 'correct', 'tags', 'explanation'
        ]
        
        writer = csv.DictWriter(f_out, fieldnames=header)
        writer.writeheader()

        count = 0
        for q in questions_data:
            try:
                # Use the new, corrected function
                options_pg = format_pg_array_correctly(q.get('options', []))
                options_hi_pg = format_pg_array_correctly(q.get('options_hi', []))
                tags_pg = format_pg_array_correctly(q.get('tags', []))
                
                explanation_jsonb = json.dumps(q.get('explanation', {}))

                writer.writerow({
                    'v1_id': q.get('id'),
                    'subject': q.get('classification', {}).get('subject'),
                    'topic': q.get('classification', {}).get('topic'),
                    'subTopic': q.get('classification', {}).get('subTopic'),
                    'examName': q.get('sourceInfo', {}).get('examName'),
                    'examYear': q.get('sourceInfo', {}).get('examYear'),
                    'examDateShift': q.get('sourceInfo', {}).get('examDateShift'),
                    'difficulty': q.get('properties', {}).get('difficulty'),
                    'questionType': q.get('properties', {}).get('questionType'),
                    'question': q.get('question'),
                    'question_hi': q.get('question_hi'),
                    'options': options_pg,
                    'options_hi': options_hi_pg,
                    'correct': q.get('correct'),
                    'tags': tags_pg,
                    'explanation': explanation_jsonb
                })
                count += 1
            except Exception as e:
                print(f"Error processing question {q.get('id')}: {e}")

    print(f"Successfully converted {count} questions to {CSV_FILE_PATH} using the correct format.")

except FileNotFoundError:
    print(f"Error: {JSON_FILE_PATH} not found.")
except Exception as e:
    print(f"An unexpected error occurred: {e}")