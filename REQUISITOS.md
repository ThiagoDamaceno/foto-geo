# Requisitos — Foto Geo (Editor de Carimbo de Telemetria + Lote)

> **Documento de entendimento dos requisitos — v2.**
> Base: `Proposta crua.txt`, imagens `1.png`/`2.png` e definições do usuário (20/07/2026).
> Complemento técnico: `ARQUITETURA.md`.

---

## 1. Visão geral

Aplicativo **desktop Windows, 100% offline**, para **carimbar fotos de drone** com os dados de telemetria que já vêm nos metadados da imagem (GPS, altitude, data/hora, modelo).

Diferente da ideia inicial (overlay fixo por checkbox), o app agora é um **editor visual de template**: o usuário monta uma **seção de dados** sobre a imagem (posição, tamanho, fonte, ícones, ordem dos campos), posiciona uma **logo livre**, salva tudo em **perfis (.ini)** e aplica o template a **N imagens** de uma vez.

**Fluxo mental:** montar o template uma vez → salvar perfil → reaproveitar em qualquer lote.

---

## 2. Stack (decidida)

- **Electron + React + TypeScript + Tailwind CSS + Vite** (via `electron-vite`).
- **Build para Windows** (`.exe`), offline.
- **Perfis em JSON** (não `.ini`).
- **Ícones:** biblioteca padrão (Lucide) — **um ícone fixo por campo** (dados são fixos).
- **Fonte:** **Roboto** (embarcada localmente para funcionar offline).

---

## 3. Dados de telemetria (sempre estes)

Extraídos dos metadados (EXIF/XMP) no momento do **import**:

| Campo | Ícone fixo (Lucide) | Origem típica |
|-------|--------------------|---------------|
| Latitude | `map-pin` | `GPSLatitude` (→ DMS `23°25'00.12"S`) |
| Longitude | `map-pin` | `GPSLongitude` (→ DMS) |
| Altitude | `ruler` / `mountain` | `GPSAltitude` / XMP DJI `RelativeAltitude` |
| Data | `calendar` | `DateTimeOriginal` (`dd/mm/aaaa`) |
| Hora | `clock` | `DateTimeOriginal` (`HH:MM:SS`) |
| Modelo do drone | `plane` / `drone` | `Make`/`Model` / XMP DJI |
| Direção (rumo) | `compass` | `GPSImgDirection` / XMP `GimbalYawDegree` *(quando existir)* |

> Cada campo tem **um ícone fixo** (mapeamento pré-definido). Sem seletor de ícone no MVP — os dados são fixos e conhecidos.

> **No import**, o app **mapeia todos os campos disponíveis** de cada foto e mostra uma **lista do que existe** (e o que falta). Campos ausentes ficam desabilitados/indicados por foto.

---

## 4. Requisitos funcionais

### RF-01 — Importação de N imagens
- Importar várias imagens (botão + **drag & drop** de arquivos/pasta).
- Formatos: **PNG, BMP, JPG/JPEG, TIFF, WEBP** (rasters comuns).
- ⚠️ **Metadados x formato:** GPS/altitude normalmente só existem em **JPG**. PNG/BMP tendem a **não** ter EXIF de GPS — o app deve mostrar claramente, por foto, quais dados foram encontrados (ver RF-02).

### RF-02 — Mapeamento e listagem dos metadados
- Ao importar, extrair e **listar todos os campos disponíveis** por imagem.
- Exibir uma visão do lote: quais fotos têm GPS/altitude/etc. e quais não têm.

### RF-03 — Seção de dados (o "carimbo" de telemetria)
- Renderizar uma **seção** sobre a imagem com os dados **empilhados verticalmente** (um abaixo do outro), como na `2.png`.
- Cada linha = ícone + rótulo/valor do campo.

### RF-04 — Reordenar campos (drag & drop)
- Arrastar os campos **para reordenar** a posição vertical dentro da seção. *(DnD serve só para trocar a ordem — não para outras edições.)*

### RF-05 — Configurações da seção
Ajustáveis pelo usuário:
- **Local/posição** da seção na imagem — **livre** (arrastar para qualquer ponto).
- **Tamanho da fonte** (fonte **Roboto**).
- **Tamanho da seção** (largura/escala do bloco).
- Ícone de cada campo é **fixo** (não configurável no MVP — ver §3).

### RF-06 — Logo (posicionamento livre)
- Importar uma logo em **PNG ou SVG**.
- **Arrastar livremente** para qualquer posição sobre a imagem (posição/tamanho livres).
- *(A marca em si — ENDEGRO vs Quartz — segue em aberto, mas a mecânica é: usuário fornece o arquivo.)*

### RF-07 — Perfis e persistência em JSON
- Salvar **todas as configurações** (seção, campos, ordem, fonte, posições, logo) em um **arquivo JSON** por perfil.
- Suportar **N perfis** (ex.: um por cliente/obra), cada um podendo referenciar sua **própria logo** (N logos).
- Carregar/editar/duplicar perfis.

### RF-08 — Preview fiel
- Mostrar **preview ao vivo** do template sobre uma imagem real, **idêntico** ao arquivo que será gerado.

### RF-09 — Aplicação em lote
- Aplicar o perfil selecionado a **todas as N imagens** importadas.
- Salvar **cópias** em pasta de saída, **preservando os originais**.
- Barra de **progresso** e **resumo** ao final (sucesso/ignoradas/erro).

### RF-10 — Preservação do original
- Nunca alterar o arquivo de entrada; sempre gerar cópia.

---

## 5. Requisitos não funcionais

| ID | Requisito |
|----|-----------|
| RNF-01 | 100% **offline** (sem rede na função principal). |
| RNF-02 | **Windows** `.exe`, duplo clique, sem runtime externo. |
| RNF-03 | Não modifica originais. |
| RNF-04 | **Independência de resolução:** o mesmo template funciona em fotos de tamanhos diferentes (posições/tamanhos relativos — ver `ARQUITETURA.md §7`). |
| RNF-05 | **Fidelidade preview↔saída:** o que se vê no editor é o que é gerado. |
| RNF-06 | Desempenho em lote (centenas de fotos, paralelismo controlado). |
| RNF-07 | PT-BR; formatos BR (data/decimal). |
| RNF-08 | Robustez: uma foto ruim não aborta o lote. |

---

## 6. Fluxo de uso

```
1. Importar N imagens (drag & drop)     → app lista os metadados encontrados
2. Escolher/editar um PERFIL
     • seção: local, tamanho, fonte
     • campos: ordem (DnD), ícones, quais mostrar
     • logo: importar PNG/SVG e arrastar livre
3. Ver preview ao vivo sobre uma foto real
4. Salvar perfil (.ini)
5. [PROCESSAR] → aplica a todas as fotos → pasta de saída
6. Resumo + abrir pasta
```

---

## 7. Modelo de configuração (resumo — detalhe em ARQUITETURA §8)

Tudo salvo em **JSON** com valores **relativos** (0–1) para posição/tamanho, mais a **ordem** dos campos e referência ao arquivo de logo. N perfis = N arquivos `.json` em `profiles/`.

---

## 8. Questões em aberto

1. **Tamanho da fonte:** valor relativo (% da imagem, escala junto) ou px fixo? *(Proponho relativo, exibindo px aproximado.)*
2. **Fotos sem GPS (PNG/BMP):** pular, copiar sem seção, ou permitir **preenchimento manual**?
3. **Nome dos arquivos de saída** (sufixo `_geo`? manter nome?).
4. **Marca/logo oficial** (ENDEGRO vs Quartz) — só afeta o exemplo/branding, não a mecânica.

**Resolvidas:** perfis em **JSON**; posição da seção e da logo **livres**; ícones = **Lucide, fixos por campo**; fonte = **Roboto**.

---

## 9. Escopo

**Fase 1 (MVP):**
- Import N imagens + mapeamento/listagem de metadados.
- Editor: seção com campos empilhados, reordenar por DnD, local/tamanho/fonte (Roboto), ícones fixos (Lucide).
- Logo importada (PNG/SVG) com posicionamento livre.
- Preview fiel + aplicação em lote + preservar originais.
- Perfis em **JSON** (salvar/carregar/duplicar).
- Build `.exe` Windows offline.

**Fase 2:**
- Seletor/troca de ícone por campo; mini mapa offline; direção (rosa dos ventos); preenchimento manual de dados ausentes; relatório CSV/PDF; import/export de perfis; templates prontos.
