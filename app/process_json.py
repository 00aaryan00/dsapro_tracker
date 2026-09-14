import json
import re

with open('src/course_data.json', 'r', encoding='utf-8') as f:
    raw_data = json.load(f)

courses = []
current_topic = "Uncategorized"
current_sessions = []

# Regex to find URLs
url_pattern = re.compile(r'(https?://\S+)')

for row in raw_data:
    if len(row) < 2:
        continue
    
    col1 = row[0].get('text', '').strip()
    col2 = row[1].get('text', '').strip()
    col3 = row[2].get('text', '').strip() if len(row) > 2 else ""
    
    if col1 == "Done" or "Major Topic" in col2:
        continue
        
    if not col3 and col2:
        if current_sessions:
            courses.append({"topic": current_topic, "sessions": current_sessions})
            current_sessions = []
        current_topic = col2
        continue
        
    if col2:
        # It's a session
        # Extract links from text
        links_found = url_pattern.findall(col3)
        # Also include any actual hrefs from docx if any
        for link_obj in row[2].get('links', []) if len(row) > 2 else []:
            href = link_obj.get('href')
            if href and href not in links_found:
                links_found.append(href)
                
        # Clean text
        text_no_links = url_pattern.sub('', col3).strip()
        
        session = {
            "title": col2,
            "details": text_no_links,
            "links": links_found,
            "id": re.sub(r'[^a-zA-Z0-9]', '', col2) + str(len(current_sessions))
        }
        current_sessions.append(session)

if current_sessions:
    courses.append({"topic": current_topic, "sessions": current_sessions})

with open('src/data.json', 'w', encoding='utf-8') as f:
    json.dump(courses, f, indent=2)
