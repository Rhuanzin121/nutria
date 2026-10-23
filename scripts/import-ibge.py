from pypdf import PdfReader, PdfWriter
import pdfplumber, re, json, sys, hashlib
from pathlib import Path
src=Path(sys.argv[1]); out=Path(sys.argv[2]); reader=PdfReader(src)
w=PdfWriter()
for p in reader.pages: w.add_page(p.rotate(90))
rot=src.with_suffix('.rotated.pdf');w.write(rot)
foods=[]; category='Alimentos IBGE/POF'; counts=[]
with pdfplumber.open(rot) as doc:
 for idx in range(35,len(doc.pages)):
  p=doc.pages[idx]; text=p.extract_text() or ''
  if 'Tabela 2 -' in text: break
  if 'Tabela 1 - Energia' not in text: continue
  words=[v for v in p.extract_words(extra_attrs=['fontname']) if v['upright']]
  codes=[v for v in words if re.fullmatch(r'\d{7}',v['text']) and v['x0']<105]
  for j,c in enumerate(codes):
   y=c['top']
   headings=[v for v in words if 'Bold' in v['fontname'] and 100<v['x0']<400 and 108<v['top']<y]
   if headings:
    hy=max(v['top'] for v in headings)
    category=' '.join(v['text'] for v in sorted(headings,key=lambda v:v['x0']) if abs(v['top']-hy)<2)
   same=[v for v in words if abs(v['top']-y)<2]
   nums=[v['text'] for v in same if v['x0']>550]
   if len(nums)!=5 or not all(re.fullmatch(r'\d+,\d+|-',v) for v in nums): raise ValueError((idx+1,c,nums))
   name=' '.join(v['text'] for v in same if 100<v['x0']<400)
   prepcode=' '.join(v['text'] for v in same if 400<v['x0']<425)
   prep=' '.join(v['text'] for v in same if 425<v['x0']<550)
   if not name or not prepcode: raise ValueError((idx,c))
   kcal,protein,fat,carbs,fiber=[(None if n=='-' else float(n.replace(',','.'))) for n in nums]
   # The POF describes some preparations using cooked proxies. Preserve its exact name and document this.
   foods.append(dict(id=f'ibge:{c["text"]}:{prepcode}',name=name+(f' · {prep}' if prepcode!='99' else ''),category=category,preparation=prep,source='IBGE · POF 2008–2009 (2011)',sourceUrl='https://biblioteca.ibge.gov.br/visualizacao/livros/liv50002.pdf',externalId=f'{c["text"]} / preparo {prepcode}',page=idx+1,unit='g',referenceAmount=100,per100=dict(kcal=kcal,protein=protein,carbs=carbs,fat=fat,fiber=fiber,sodium=None,saturated=None),notes='Composição por 100 g de parte comestível, conforme Tabela 1 do IBGE/POF (2011). A fonte usa preparações padronizadas e, em alguns casos, alimentos similares/cozidos como referência; consulte os critérios metodológicos do PDF (p.31–33). Não representa rótulo atual de marca.',measures=[]))
  counts.append((idx+1,len(codes)))
ids=[f['id'] for f in foods]
assert len(ids)==len(set(ids)), 'IDs repetidos'
assert len(foods)>1000
out.write_text(json.dumps(foods,ensure_ascii=False,separators=(',',':')),encoding='utf8')
print(json.dumps(dict(records=len(foods),pages=counts,sha256=hashlib.sha256(src.read_bytes()).hexdigest())))
