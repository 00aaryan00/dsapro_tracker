from bs4 import BeautifulSoup
import json
import sys
import re

def parse_html(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f, 'html.parser')

    data = []
    
    tables = soup.find_all('table')
    
    for table in tables:
        for row in table.find_all('tr'):
            cells = row.find_all(['td', 'th'])
            row_data = []
            for cell in cells:
                # Extract text and links
                links = cell.find_all('a')
                cell_obj = {
                    "text": cell.get_text(strip=True).replace('\n', ' '),
                    "links": [{"text": a.get_text(strip=True), "href": a.get('href')} for a in links if a.get('href')]
                }
                row_data.append(cell_obj)
            if row_data:
                data.append(row_data)
                
    with open('course_data.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    parse_html(sys.argv[1])
