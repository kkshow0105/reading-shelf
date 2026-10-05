"""Original geometric mock covers; no publisher imagery or remote images."""
from pathlib import Path
from html import escape

DEST = Path(__file__).resolve().parents[1] / 'public' / 'covers'
DEST.mkdir(parents=True, exist_ok=True)
SERIF = 'Noto Serif SC,Source Han Serif SC,Songti SC,SimSun,serif'
SANS = 'Noto Sans SC,PingFang SC,Microsoft YaHei,sans-serif'

def text(x, y, value, size=20, color='#24211D', weight=400, anchor='start', family=SERIF):
    return f'<text x="{x}" y="{y}" fill="{color}" font-family="{family}" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}">{escape(value)}</text>'

def cover(key, background, author, pieces, ink='#24211D'):
    signature = text(26, 517, 'READING SHELF · 原创测试封面', 10, ink, family=SANS)
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="360" height="540" viewBox="0 0 360 540"><rect width="360" height="540" fill="{background}"/>{pieces}{text(26, 487, author, 16, ink)}{signature}</svg>'
    (DEST / f'{key}.svg').write_text(svg, encoding='utf-8')

cover('siddhartha', '#CCAA67', '赫尔曼·黑塞', text(28, 46, 'SIDDHARTHA', 14) + ''.join(text(180, 150 + i*87, c, 68, anchor='middle') for i,c in enumerate('悉达多')) + '<path d="M25 377Q120 331 335 378M25 397Q190 357 335 404M25 417Q190 394 335 432" fill="none" stroke="#574832" stroke-width="1.5"/>')
cover('sisyphus', '#663440', '阿尔贝·加缪', text(28, 50, 'LE MYTHE DE SISYPHE', 12, '#F0DDC6') + text(28, 130, '西西弗', 53, '#F0DDC6', 600) + text(28, 193, '神话', 53, '#F0DDC6', 600) + '<path d="M0 448L260 272L360 368V454H0Z" fill="#BE8D7E"/><circle cx="214" cy="260" r="63" fill="#D7B19B"/><path d="M179 234L247 283" stroke="#663440" stroke-width="2"/>', '#F0DDC6')
cover('stranger', '#9BACB2', '阿尔贝·加缪', text(28, 48, "L’ÉTRANGER", 13) + text(180, 128, '局外人', 61, weight=600, anchor='middle') + '<circle cx="180" cy="285" r="88" fill="#E6E0D1"/><path d="M0 367L360 330V450H0Z" fill="#526771"/><path d="M0 395L360 362" stroke="#E6E0D1" stroke-width="1"/>')
cover('gate', '#E7DFCF', '安德烈·纪德', text(28, 48, 'LA PORTE ÉTROITE', 13) + text(28, 136, '窄门', 66, weight=600) + '<path d="M119 436V247A61 61 0 0 1 241 247V436Z" fill="#353B32"/><path d="M165 436V258A15 15 0 0 1 195 258V436Z" fill="#B96D43"/><path d="M100 439H260" stroke="#24211D" stroke-width="1"/>')
cover('plague', '#425B4B', '阿尔贝·加缪', text(28, 48, 'LA PESTE', 13, '#E8DBC0') + text(28, 135, '鼠', 66, '#E8DBC0', 600) + text(28, 217, '疫', 66, '#E8DBC0', 600) + '<g stroke="#AEBBA4" fill="none" stroke-width="1"><path d="M150 202V422H328V285H285V230H231V176H191V202Z"/><path d="M175 254H209M175 281H209M175 308H209M246 294H273M246 321H273M297 352H315M175 348H209M175 375H209"/></g>', '#E8DBC0')
cover('veil', '#D7A08D', '威廉·萨默塞特·毛姆', text(28, 48, 'THE PAINTED VEIL', 13) + '<path d="M75 135C260 83 264 238 284 403C204 370 157 428 75 417Z" fill="#ECCBB5"/><path d="M100 155C182 262 125 328 231 400M144 145C213 243 143 312 269 374" fill="none" stroke="#B57566" stroke-width="2"/>' + text(180, 286, '面纱', 66, weight=600, anchor='middle'))
cover('moon', '#344451', '威廉·萨默塞特·毛姆', text(28, 48, 'THE MOON AND SIXPENCE', 12, '#EDE3CA') + '<circle cx="246" cy="155" r="70" fill="#D9C19A"/><circle cx="267" cy="131" r="63" fill="#344451"/>' + text(28, 279, '月亮与', 48, '#EDE3CA', 600) + text(28, 341, '六便士', 48, '#EDE3CA', 600) + ''.join(f'<circle cx="{44+i*44}" cy="411" r="12" stroke="#C6A87C" fill="none"/>' for i in range(6)), '#EDE3CA')
cover('zarathustra', '#B96742', '弗里德里希·尼采', text(26, 43, 'ALSO SPRACH ZARATHUSTRA', 11, '#F1E4CC') + text(26, 109, '查拉图斯特拉', 38, '#F1E4CC', 600) + text(26, 163, '如是说', 45, '#F1E4CC', 600) + '<path d="M0 428L184 217L360 428Z" fill="#483C34"/><path d="M102 313L184 217L228 270L186 257L163 285L143 275Z" fill="#E8D5B0"/><path d="M0 448H360" stroke="#F1E4CC"/>', '#F1E4CC')
cover('lightness', '#B0B6A4', '米兰·昆德拉', text(26, 44, 'THE UNBEARABLE LIGHTNESS OF BEING', 10) + text(26, 121, '不能承受的', 43, weight=600) + text(26, 181, '生命之轻', 48, weight=600) + '<path d="M86 412L277 234M86 412Q135 263 277 234M86 412Q253 389 277 234M146 360L122 329M170 338L151 292M202 308L193 264" fill="none" stroke="#4D5F4F" stroke-width="2"/>')
cover('human', '#833F35', '太宰治', text(28, 48, 'NO LONGER HUMAN', 13, '#EDDDC7') + '<rect x="151" y="112" width="166" height="316" fill="#4A302B"/><circle cx="235" cy="212" r="46" fill="#B87B60"/><path d="M169 386Q193 261 261 264L298 386Z" fill="#B87B60"/>' + ''.join(text(59, 150+i*89, c, 65, '#EDDDC7', 600) for i,c in enumerate('人间失格')), '#EDDDC7')
cover('solitude', '#D6BA70', '加西亚·马尔克斯', text(26, 44, 'CIEN AÑOS DE SOLEDAD', 12) + text(180, 187, '百年', 70, weight=600, anchor='middle') + text(180, 273, '孤独', 70, weight=600, anchor='middle') + '<g fill="none" stroke="#586044" stroke-width="2"><path d="M64 426Q105 366 54 310M296 426Q255 366 306 310M64 426Q97 395 136 418M296 426Q263 395 224 418"/><path d="M64 370L39 345L49 376L73 388M296 370L321 345L311 376L287 388"/></g>')
cover('sea', '#779B9A', '欧内斯特·海明威', text(26, 43, 'THE OLD MAN AND THE SEA', 12, '#F0E6D0') + text(26, 127, '老人与海', 53, '#F0E6D0', 600) + '<g fill="none" stroke="#E5DECB" stroke-width="1.5"><path d="M0 277Q60 249 120 277T240 277T360 277M0 320Q60 292 120 320T240 320T360 320M0 363Q60 335 120 363T240 363T360 363M0 406Q60 378 120 406T240 406T360 406"/></g><path d="M139 239H223L211 253H151Z" fill="#304C52"/><path d="M181 178V239L214 235Z" fill="#304C52"/>', '#F0E6D0')
print(f'Generated 12 original covers in {DEST}')
