import sys,json,re,hashlib
from pathlib import Path
import pymupdf
if len(sys.argv)!=3:raise SystemExit('Uso: python scripts/import-taco.py original.pdf destino.json')
source=Path(sys.argv[1]);target=Path(sys.argv[2])
if hashlib.sha256(source.read_bytes()).hexdigest()!='2002aec5615b5b1395aaa8fa675635bbb7f712c33f278af5e332f1cac8f108c8':raise SystemExit('PDF diferente da edição validada. Revise as coordenadas antes de importar.')
pdf=pymupdf.open(source);foods=[];category='';url='https://nepa.unicamp.br/wp-content/uploads/sites/27/2023/10/taco_4_edicao_ampliada_e_revisada.pdf'
def val(s):
 try:return float(s.replace(',','.'))
 except:return None
for pn in range(28,67,2):
 words=pdf[pn].get_text('words')
 ids=[w for w in words if w[0]>140 and w[1]>735 and re.fullmatch(r'\d+',w[4]) and 1<=int(w[4])<=597]
 sodiumwords=pdf[pn+1].get_text('words')
 for row in ids:
  rid=int(row[4]);x=row[0]
  rw=[w for w in words if abs(w[0]-x)<1.5]
  name=' '.join(w[4] for w in sorted(rw,key=lambda w:-w[1]) if 480<w[1]<735)
  if not name:continue
  headings=[w for w in words if 147<w[0]<x-1 and w[1]>480 and w[0] not in [i[0] for i in ids]]
  # category boundaries from the official table's row IDs
  bounds=[(1,'Cereais e derivados'),(64,'Verduras e hortaliças'),(163,'Frutas e derivados'),(259,'Gorduras e óleos'),(273,'Pescados e frutos do mar'),(323,'Carnes e derivados'),(446,'Leite e derivados'),(470,'Bebidas'),(484,'Ovos e derivados'),(491,'Produtos açucarados'),(511,'Miscelâneas'),(520,'Outros industrializados'),(525,'Alimentos preparados'),(557,'Leguminosas e derivados'),(587,'Nozes e sementes')]
  category=next(c for i,c in reversed(bounds) if rid>=i)
  def col(mid):
   found=[w[4] for w in rw if abs((w[1]+w[3])/2-mid)<13]
   return val(found[0]) if len(found)==1 else None
  sid=next((w for w in sodiumwords if w[0]>140 and w[1]>735 and w[4]==str(rid)),None)
  sodium=None
  if sid:
   sw=[w[4] for w in sodiumwords if abs(w[0]-sid[0])<1.5 and abs((w[1]+w[3])/2-563)<16]
   sodium=val(sw[0]) if len(sw)==1 else None
  per={'kcal':col(414),'protein':col(353),'fat':col(314),'carbs':col(233),'fiber':col(195),'sodium':sodium,'saturated':None}
  aliases=[]
  if rid in [3,4]:aliases=['arroz branco']
  if 'Batata, inglesa' in name:aliases=['batata inglesa']
  if 'Queijo, mozarela' in name:aliases=['muçarela','mussarela']
  foods.append(dict(id=f'taco:{rid}',externalId=str(rid),name=name,brand='',preparation='',aliases=aliases,category=category,source='TACO · NEPA/UNICAMP · 4ª ed. (2011)',sourceUrl=url,page=pn-2,updatedAt='2011',unit='g',referenceAmount=100,per100=per,manual=False,notes='Tr (traços), NA e campos vazios são preservados como desconhecidos. Saturadas não importadas nesta versão.'))
assert len(foods)==597,(len(foods),[i for i in range(1,598) if f'taco:{i}' not in [f['id'] for f in foods]])
assert foods[2]['per100']['kcal']==128 and foods[2]['per100']['carbs']==28.1
target.write_text(json.dumps(foods,ensure_ascii=False,indent=2),encoding='utf8')
print('Imported',len(foods),'foods. SHA256',hashlib.sha256(source.read_bytes()).hexdigest())
