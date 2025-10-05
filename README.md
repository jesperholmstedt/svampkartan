
# 🍄 Min Svampkarta

En personlig svampkarta där du kan markera platser där du hittat svampar.

## Översikt

Min Svampkarta är en enkel och elegant webbapplikation som gör det möjligt för användare att:

- 🗺️ Visa en interaktiv karta
- 📍 Klicka för att markera platser där du hittat svampar  
- 🍄 Lägg till namn och anteckningar för varje fynd
- 👀 Visa detaljer om dina markerade platser
- 🗑️ Ta bort markeringar du inte längre vill ha

## Funktioner

### 🗺️ Finsk Topografisk Karta
- Real karta från Maanmittauslaitos (MML) - Finlands topografiska karta
- Klicka på "Lägg till plats" för att aktivera markeringsläge
- Klicka var som helst på kartan för att skapa en ny markering
- Alla dina svampfynd visas som röda markörer med svampikoner
- Zoom och panorera för att utforska olika områden

### 📝 Hantera Fynd
- Lägg till namn på svampart (t.ex. "Kantarell", "Karljohan")
- Skriv anteckningar om fyndet (beskrivning, antal, miljö)
- Datum sparas automatiskt
- GPS-koordinater visas för varje markering
- Klicka på befintliga markörer för att visa eller ta bort dem

### 🎨 Design
- Ren och enkel design fokuserad på kartan
- Responsiv för alla enheter
- Grön naturfärg-tema

## Teknisk Stack

- **Framework**: Next.js 15 med App Router
- **Språk**: TypeScript
- **Styling**: Tailwind CSS
- **Karta**: Leaflet med Finsk MML (Maanmittauslaitos) topografisk karta
- **Build Tool**: Webpack (via Next.js)
- **Package Manager**: npm

## Installera och Köra

### Förutsättningar

- Node.js 18+ installerat
- npm installerat

### Installation

1. Klona projektet (eller använd befintligt workspace)
2. Installera beroenden:
   ```bash
   npm install
   ```

### Utveckling

Starta utvecklingsservern:
```bash
npm run dev
```

Applikationen kommer att vara tillgänglig på [http://localhost:3000](http://localhost:3000)

### Bygga för produktion

```bash
npm run build
npm start
```

## Projektstruktur

```
svampkartan/
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── globals.css       # Global stilar
│   │   ├── layout.tsx        # Root layout
│   │   └── page.tsx          # Huvudsida
│   └── components/           # React komponenter
│       └── MapComponent.tsx  # Huvudkartkomponent
├── .github/
│   └── copilot-instructions.md
├── next.config.js            # Next.js konfiguration
├── tailwind.config.js        # Tailwind CSS konfiguration
├── tsconfig.json             # TypeScript konfiguration
└── package.json              # Projektberoenden
```

## Framtida Förbättringar

- [ ] Integration med riktiga kartjänster (Leaflet, Google Maps)
- [ ] Lokal lagring av markeringar (localStorage)
- [ ] Export/import av svampfynd
- [ ] GPS-koordinater för noggrannare positionering
- [ ] Bilder för varje markering

## Bidra

1. Fork projektet
2. Skapa en feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit dina ändringar (`git commit -m 'Add some AmazingFeature'`)
4. Push till branch (`git push origin feature/AmazingFeature`)
5. Öppna en Pull Request

## Licens

Detta projekt är öppen källkod under MIT-licensen.

## Support

För frågor eller support, skapa en issue i projektets repository.
