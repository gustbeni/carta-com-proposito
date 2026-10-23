#!/usr/bin/env python3
"""Monta public/index.html a partir dos arquivos desta pasta.

Uso (na raiz do projeto):  python3 fonte/montar.py

carta_tpl.html .... página inteira (HTML + JS), com os marcadores {{CSS}} e {{DADOS}}
estilo-base.css ... CSS base, entra no lugar de {{CSS}}
dados.json ........ versículos, orações e textos, entram no lugar de {{DADOS}}
"""
import json, os
aqui = os.path.dirname(os.path.abspath(__file__))
raiz = os.path.dirname(aqui)
t = open(os.path.join(aqui, "carta_tpl.html"), encoding="utf-8").read()
css = open(os.path.join(aqui, "estilo-base.css"), encoding="utf-8").read()
d = json.dumps(json.load(open(os.path.join(aqui, "dados.json"), encoding="utf-8")), ensure_ascii=False).replace("</", "<\\/")
h = t.replace("{{CSS}}", css).replace("{{DADOS}}", d)
i = h.index("</style>") + len("</style>")
doc = ('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
       '<meta name="viewport" content="width=device-width, initial-scale=1">' + h[:i] + "</head><body>" + h[i:] + "</body></html>")
open(os.path.join(raiz, "public", "index.html"), "w", encoding="utf-8").write(doc)
print("public/index.html montado:", len(doc), "caracteres")
