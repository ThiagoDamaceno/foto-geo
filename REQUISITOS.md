# Requisitos — Foto Geo (Editor de Carimbo de Telemetria + Lote)

> **Documento de entendimento dos requisitos — v3.**
> Base: `Proposta crua.txt`, imagens `1.png`/`2.png`, definições do usuário (20/07/2026) e **amostra real de 13 fotos** em `drone/` (DJI Lito X1).
> Complemento técnico: `ARQUITETURA.md`.

---

## 1. Visão geral

Aplicativo **desktop Windows, 100% offline**, para **carimbar fotos de drone** com os dados de telemetria que já vêm nos metadados da imagem (GPS, altitude, data/hora, modelo).

**Formato-alvo (confirmado pela amostra):** fotos **JPG da DJI (linha Lito X1 / `FC9589`)**, `8064×4536` (~36 MP), ~24–27 MB, com **EXIF _e_ XMP `drone-dji`** completos. É o caso principal do produto; outros formatos (PNG/BMP/TIFF/WEBP) são secundários e podem não ter GPS (ver RF-01/RF-02).

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

Extraídos dos metadados (EXIF/XMP) no momento do **import**. As colunas de origem refletem o que foi **verificado na amostra real** (DJI Lito X1):

| Campo | Ícone fixo (Lucide) | Origem (prioridade) | Exemplo real |
|-------|--------------------|---------------------|--------------|
| Latitude | `map-pin` | XMP `drone-dji:GpsLatitude` (decimal) → **fallback** EXIF `GPSLatitude`+`GPSLatitudeRef` | `-22.991331444` → `22°59'28.79"S` |
| Longitude | `map-pin` | XMP `drone-dji:GpsLongitude` (decimal) → **fallback** EXIF `GPSLongitude`+`GPSLongitudeRef` | `-52.431268574` → `52°25'52.57"W` |
| Altitude | `mountain` | **Absoluta:** EXIF `GPSAltitude` = XMP `drone-dji:AbsoluteAltitude` (padrão no carimbo). **Relativa** (à decolagem): XMP `drone-dji:RelativeAltitude` — disponível como opção | Abs. `+621,50 m` · Rel. `+132,20 m` |
| Data | `calendar` | EXIF `DateTimeOriginal`/`DateTime` → fallback XMP `xmp:CreateDate` (ISO c/ fuso) | `2026-07-18` |
| Hora | `clock` | mesma origem da Data | `15:57:12` |
| Modelo do drone | `plane` | **XMP `drone-dji:ProductName`** (nome amigável) → fallback `Make`+`Model` | `Lito X1` (não `DJI FC9589`) |
| Direção (rumo) | `compass` | XMP `drone-dji:GimbalYawDegree` (para onde a câmera aponta), normalizado 0–360° → fallback `FlightYawDegree` | `-60.30` → `299,7°` |

> **Importante — GPS não vem só do EXIF padrão:** a linha DJI grava a posição também (e de forma mais limpa, em **graus decimais com sinal**) no bloco **XMP `drone-dji`**. A leitura deve priorizar o XMP e usar o EXIF como fallback. `GPSImgDirection` **não existe** nestas fotos — a direção vem exclusivamente do XMP (gimbal/flight yaw).

> **Modelo:** o `Model` do EXIF é o código do sensor (`FC9589`), sem valor para o usuário. Exibir sempre o `drone-dji:ProductName` (`Lito X1`), como já mostra a proposta.

> Cada campo tem **um ícone fixo** (mapeamento pré-definido). Sem seletor de ícone no MVP — os dados são fixos e conhecidos.

> **No import**, o app **mapeia todos os campos disponíveis** de cada foto e mostra uma **lista do que existe** (e o que falta). Campos ausentes ficam desabilitados/indicados por foto.

---

## 4. Requisitos funcionais

### RF-01 — Importação de N imagens
- Importar várias imagens (botão + **drag & drop** de arquivos/pasta).
- **Formato principal (garantido):** **JPG/JPEG** da DJI (EXIF + XMP `drone-dji`) — é o que o drone produz e o foco do MVP.
- Formatos secundários aceitos: **PNG, BMP, TIFF, WEBP** (podem não ter telemetria).
- ⚠️ **Metadados x formato:** na amostra real (JPG DJI) **todos** os campos existem. PNG/BMP tendem a **não** ter EXIF/XMP de GPS — o app deve mostrar claramente, por foto, quais dados foram encontrados (ver RF-02).

### RF-02 — Mapeamento e listagem dos metadados
- Ao importar, extrair e **listar todos os campos disponíveis** por imagem.
- Exibir uma visão do lote: quais fotos têm GPS/altitude/etc. e quais não têm.

### RF-03 — Seção de dados (o "carimbo" de telemetria)
- Renderizar uma **seção** sobre a imagem com os dados **empilhados verticalmente** (um abaixo do outro), como na `2.png`.
- Cada linha = ícone + rótulo/valor do campo.

### RF-04 — Reordenar campos (drag & drop)
- Arrastar os campos **para reordenar** a posição vertical dentro da seção. *(DnD serve só para trocar a ordem — não para outras edições.)*

### RF-05 — Configurações da seção
> A interface do app tem tema **claro/escuro** (RNF-09) — isso vale para o editor todo;
> não afeta o carimbo gerado, cujas cores vêm do template (`bgColor`/`textColor`).

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
| RNF-09 | **Tema claro/escuro** em toda a interface — **apenas esses dois modos** (sem opção "Sistema"), alternáveis no cabeçalho e **persistidos** entre execuções. Na primeira execução o app adota o modo de cor do Windows como valor inicial. Todo componente novo deve nascer com as duas variantes. |
| RNF-10 | **Sem console/DevTools para o usuário:** `F12`, `Ctrl+Shift+I/J/C` (e `Cmd+Alt+I`) bloqueados, DevTools desligado na janela e menu nativo removido. Depuração em desenvolvimento com `FOTOGEO_DEVTOOLS=1 yarn dev`. |

---

## 6. Fluxo de uso

```
1. Importar N imagens (drag & drop)     → app lista os metadados encontrados
2. Escolher/editar um PERFIL
     • seção: local, tamanho, fonte
     • campos: ordem (DnD), ícones, quais mostrar
     • logo: importar PNG/SVG e arrastar livre
3. Ver preview ao vivo sobre uma foto real
4. Salvar perfil (.json)
5. [PROCESSAR] → aplica a todas as fotos → pasta de saída
6. Resumo + abrir pasta
```

---

## 7. Modelo de configuração (resumo — detalhe em ARQUITETURA §8)

Tudo salvo em **JSON** com valores **relativos** (0–1) para posição/tamanho, mais a **ordem** dos campos e referência ao arquivo de logo. N perfis = N arquivos `.json` em `profiles/`.

---

## 8. Dados de teste (amostra real)

Pasta `drone/` = **13 fotos** JPG do **DJI Lito X1** (`FC9589`), usadas como referência de desenvolvimento e teste de fidelidade.

| Propriedade | Valor observado |
|-------------|-----------------|
| Nome dos arquivos | `dji_fly_AAAAMMDD_HHMMSS_NNNN_<id>_photo.jpg` (o `NNNN` é o nº sequencial da foto) |
| Resolução | `8064 × 4536` (~36 MP) |
| Tamanho | ~24–27 MB por arquivo |
| Metadados | EXIF (Make/Model/DateTime/GPS DMS/GPSAltitude) **+** XMP `drone-dji` (GPS decimal, Absolute/RelativeAltitude, GimbalYawDegree, ProductName, GpsStatus etc.) |

> Implicações: (a) o **modelo de coordenadas relativas** (`ARQUITETURA §7`) é obrigatório — arquivos de 8064 px; (b) **desempenho/memória** importam (arquivos grandes em lote → `sharp` streaming + `p-limit`); (c) o nº sequencial do arquivo pode alimentar o campo "número da foto".

---

## 9. Questões em aberto

1. **Altitude a exibir:** implementado como **absoluta** (`AbsoluteAltitude`/`GPSAltitude`), caindo na **relativa** quando a absoluta falta. Confirmar se a relativa deve virar opção no inspector ou aparecer junto.
2. **Nome dos arquivos de saída** (sufixo `_geo`? manter nome?) — ainda em aberto; o lote (passo 7) precisa dessa definição.
3. **Marca/logo oficial** (ENDEGRO vs Quartz) — só afeta o exemplo/branding, não a mecânica.

**Resolvidas:** perfis em **JSON**; posição da seção e da logo **livres**; ícones = **Lucide, fixos por campo**; fonte = **Roboto**; **formato principal = JPG DJI** (EXIF+XMP presentes); **GPS lido do XMP `drone-dji` (decimal)** com fallback EXIF; **modelo = `ProductName`**; **tamanho da fonte é relativo** (`fontPct` = fração da largura da imagem — escala junto, RNF-04); **campo sem valor não entra no carimbo** (a caixa encolhe). Fotos PNG/BMP sem GPS deixam de ser o caso central (secundário — a definir tratamento).

---

## 10. Escopo

**Fase 1 (MVP):**
- Import N imagens + mapeamento/listagem de metadados.
- Editor: seção com campos empilhados, reordenar por DnD, local/tamanho/fonte (Roboto), ícones fixos (Lucide).
- Logo importada (PNG/SVG) com posicionamento livre.
- Preview fiel + aplicação em lote + preservar originais.
- Perfis em **JSON** (salvar/carregar/duplicar).
- Build `.exe` Windows offline.

**Fase 2:**
- Seletor/troca de ícone por campo; mini mapa offline; direção (rosa dos ventos); preenchimento manual de dados ausentes; relatório CSV/PDF; import/export de perfis; templates prontos.

---

## 11. Requisitos de instalação (ambiente de desenvolvimento)

Estado atual do repo (`ARQUITETURA.md §14`, passos 1–4): **import com leitura de telemetria
(RF-01/RF-02), carimbo gerado pelo Sharp em tamanho real e preview fiel (RF-03/RF-08), com a
seção arrastável e redimensionável (parte do RF-05)**. Faltam ordem dos campos por DnD (RF-04),
inspector, logo (RF-06), perfis (RF-07) e lote (RF-09). Empacotamento ainda **não** está
configurado — ver §11.6.

### 11.1 Pré-requisitos

| Item | Versão | Observação |
|------|--------|------------|
| **Node.js** | **24.18.0** | Fixado em `.tool-versions` (asdf/mise instalam automaticamente com `asdf install`). |
| **Yarn** | **1.22.x** (classic) | Gerenciador do projeto — o lock versionado é o `yarn.lock`. Não misturar `npm install` (geraria `package-lock.json` divergente). |
| **Git** | qualquer | — |
| Sistema de execução | **Windows 10/11 x64** | Alvo do produto (RNF-02). |
| Sistema de desenvolvimento | Windows, ou **WSL2 + WSLg** / Linux com X11-Wayland | No WSL há libs extras a instalar — §11.3. |

Nada além disso: o app é offline e não depende de serviço externo, banco ou runtime instalado
na máquina do usuário final.

### 11.2 Instalação e execução

```bash
git clone <repo> && cd drone
yarn install          # instala dependências e baixa o binário do Electron
yarn dev              # abre o app (HMR no Renderer)
```

Outros comandos: `yarn dev:watch` (reinicia o Main a cada alteração) e `yarn typecheck`
(`tsc` em main/preload e renderer). O `electron-vite` compila para `out/` — pasta ignorada
pelo Git, inclusive em dev.

### 11.3 Desenvolvendo no WSL (Ubuntu)

O binário do Electron precisa de bibliotecas que não vêm no WSL enxuto —
sem elas ele nem inicia (`error while loading shared libraries: libnspr4.so`):

```bash
sudo apt update
sudo apt install -y libnss3 libnspr4 libasound2t64   # Ubuntu < 24.04: libasound2
```

Ainda é necessário **WSLg** (Windows 11, ou Windows 10 com WSL atualizado) para a janela
aparecer — confira que `echo $DISPLAY` retorna algo (ex.: `:0`).

A leitura de metadados usa o `exiftool-vendored`, que no Linux executa o **exiftool em perl**
com o interpretador do sistema (o Ubuntu já traz; confira com `perl -v`). No Windows o pacote
usa o `exiftool.exe` embarcado — nada a instalar.

O WSL não expõe GPU utilizável ao Chromium; o Main já **desliga a aceleração de hardware
quando `process.platform === 'linux'`**, então a renderização é por software (suficiente
para o editor) e o log fica limpo. Em Windows a aceleração continua ligada.

**Ruído esperado no WSL:** ao usar o `sharp` dentro do Electron em Linux aparecem o aviso
`[SharpElectronLinux] Binaries provided by Electron … may be incompatible with sharp` e várias
linhas `GLib-GObject: g_object_ref: assertion 'G_IS_OBJECT (object)' failed`. O render funciona
(verificado nas 13 fotos da amostra) — é conflito de GLib entre o libvips e o Electron, e não
acontece no Windows, que é o alvo. Ignore essas linhas ao ler o log.

### 11.4 Fotos de teste no WSL (arquivos que estão no Windows)

Não é preciso gerar build no Windows para testar com fotos reais — o `yarn dev` no WSL
lê os arquivos normalmente. Três caminhos:

1. **Amostra já no repo:** `exemplos/fotos drone/` (13 JPGs do Lito X1, ~311 MB, fora do Git).
   É o caminho recomendado para o dia a dia.
2. **Ler direto do Windows:** o disco do Windows está montado em `/mnt/c/...`
   (ex.: `/mnt/c/Users/<usuário>/Pictures/drone`). Funciona no seletor de arquivos do app,
   mas o `/mnt` é **lento** (9p/DrvFs) — não serve para medir desempenho de lote (RNF-06).
3. **Copiar para dentro do WSL** antes de testar (I/O nativo):
   ```bash
   cp -r /mnt/c/Users/<usuário>/Pictures/drone ~/fotos-teste
   ```

⚠️ **Drag & drop (RF-01) não é testável no WSL:** o WSLg não faz arrastar-e-soltar entre o
Explorer do Windows e janelas Linux. Valide o DnD arrastando de um gerenciador de arquivos
Linux, ou rodando o app no Windows. O import por **botão/seletor** cobre o resto do fluxo.

> Rodar o `yarn dev` direto no Windows (Node + Yarn no PowerShell, código no disco `C:`)
> também é uma opção — aí DnD e desempenho ficam iguais ao do usuário final. Só não misture
> o mesmo `node_modules` entre WSL e Windows (binários de plataforma diferente).

### 11.5 Dependências nativas

| Pacote | Situação | Observação |
|--------|----------|------------|
| `exiftool-vendored` | **instalado** (leitura de EXIF/XMP) | Vem com binários por plataforma; no Linux precisa do perl do sistema (§11.3). |
| `sharp` | **instalado** (render do carimbo) | libvips com binário por plataforma (`@img/sharp-linux-x64` aqui, `win32-x64` no `.exe`). |
| `lucide-static` | **instalado** | SVG cru dos ícones do carimbo (sem binário). |

Binários instalados no WSL/Linux valem só para desenvolvimento — o `.exe` final exige os
binários **win-x64**, baixados/reconstruídos no Windows na etapa de empacotamento.

### 11.6 Empacotamento — postergado

O `electron-builder` foi removido do projeto por ora (só `yarn dev` até o MVP fechar).
Para retomar (`ARQUITETURA.md §12`, passo 8 do §14): adicionar `electron-builder` em
`devDependencies`, recriar o `electron-builder.yml` (targets **nsis** + **portable**, x64,
`asarUnpack` dos módulos nativos, `assets/` em `extraResources`), a pasta `build/` com o
`icon.ico` e rodar `electron-builder --win` **no Windows**.
