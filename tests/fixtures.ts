// Nachgebaute Ausschnitte im Aufbau der echten Seiten (geprüft am 05.11.2026 im Browser):
// LeasingMarkt liefert die Daten als Next.js-Datenblöcke, mydealz als RSS 2.0 mit pepper:merchant.

/** Wie Next.js die Daten in die Seite schreibt: self.__next_f.push([1,"<JSON-escapter Text>"]) */
export function nextSeite(payload: string, teile = 3): string {
  const n = Math.ceil(payload.length / teile);
  const bloecke = [];
  for (let i = 0; i < payload.length; i += n) bloecke.push(`<script>self.__next_f.push([1,${JSON.stringify(payload.slice(i, i + n))}])</script>`);
  return `<!DOCTYPE html><html><head><title>x</title></head><body><div>Karten</div><script>(self.__next_f=self.__next_f||[]).push([0])</script>${bloecke.join('')}</body></html>`;
}

export const LM_LISTE = {
  currentPage: 1,
  itemsPerPage: 15,
  totalPages: 13,
  totalResults: 193,
  listings: [
    {
      id: 13342515,
      listingOwnerId: 1,
      targetGroup: 'Nur Privatkunden',
      contractType: 'NEW',
      isDeal: true,
      isOnline: true,
      dealPublishedAt: null,
      makeName: 'Cupra',
      modelName: 'Leon',
      headline: 'Sportstourer 2.0 TSI 245kW VZ DSG {Sonder}',
      leasingOffer: { id: 39185747, leaseTotalAmount: 4776, duration: 24, includedMileage: 10000, monthlyRate: 199, monthlyNetRate: 167.23, leasingFactor: 0.32, listingRating: 8.9 },
      offers: [
        { id: 39185747, leaseTotalAmount: 4776, duration: 24, includedMileage: 10000, monthlyRate: 199, monthlyNetRate: 167.23, leasingFactor: 0.32 },
        { id: 39185748, duration: 36, includedMileage: 10000, monthlyRate: 256, monthlyNetRate: 215.13, leasingFactor: 0.41 },
        { id: 39185749, duration: 24, includedMileage: 5000, monthlyRate: 179, monthlyNetRate: 150.42, leasingFactor: 0.29 },
      ],
      grossListPriceInEUR: 62145,
      engine: { power: { kw: 245, hp: 333 }, transmissionType: 'Automatik' },
      url: '/leasing/pkw/cupra-leon/13342515?adVariant=x',
      availability: 'Verfügbar: Sofort',
      condition: { mileageInKm: 0, carType: 'Neuwagen', isNewCar: true },
      brandModelName: 'Cupra Leon',
      brandModelTitle: 'Sportstourer 2.0 TSI 245kW VZ DSG',
      specialConditions: [],
    },
    {
      id: 13284172,
      targetGroup: 'Nur Gewerbekunden',
      contractType: 'NEW',
      isOnline: true,
      dealPublishedAt: '2026-10-15T14:37:38.000000Z',
      headline: 'Cupra Leon VZ Extreme | Gewerbe | Vorlauf',
      leasingOffer: { id: 37335253, leaseTotalAmount: 5397.84, duration: 24, includedMileage: 10000, monthlyRate: 224.91, monthlyNetRate: 189, leasingFactor: 0.34 },
      offers: [{ id: 37335253, duration: 24, includedMileage: 10000, monthlyRate: 224.91, monthlyNetRate: 189, leasingFactor: 0.34 }],
      grossListPriceInEUR: 66890,
      engine: { power: { kw: 245, hp: 333 } },
      url: '/leasing/pkw/cupra-leon/13284172',
      availability: 'Verfügbar: 01/2027',
      condition: { carType: 'Vorlauffahrzeug', isNewCar: true },
      brandModelName: 'Cupra Leon',
      brandModelTitle: 'VZ Extreme 4 Drive Sportstourer | Gewerbe | Vorbestellte Fahrzeuge',
    },
    {
      id: 13000001,
      targetGroup: 'Privat- & Gewerbekunden',
      contractType: 'NEW',
      isOnline: true,
      headline: '1.5 TSI DSG *ohne SONDERZAHLUNG*',
      leasingOffer: { id: 1, duration: 24, includedMileage: 10000, monthlyRate: 219, monthlyNetRate: 184.03, leasingFactor: 0.46 },
      grossListPriceInEUR: 47325,
      engine: { power: { kw: 110, hp: 150 } },
      url: '/leasing/pkw/cupra-leon/13000001',
      availability: 'Verfügbar: Sofort',
      condition: { carType: 'Neuwagen', isNewCar: true },
      brandModelName: 'Cupra Leon',
      brandModelTitle: '1.5 TSI DSG *ohne SONDERZAHLUNG*',
    },
  ],
};

export function lmListenSeite(liste = LM_LISTE) {
  const davor = '1:"$Sreact.fragment"\n10:["$","div",null,{"adsPlacement":"x","searchFilter":{"tg":"ALL","p":1,"sort":"rate","mn":102,"mag":["1695"]},';
  return nextSeite(`${davor}"initialResult":${JSON.stringify(liste)},"taxonomy":{"manufacturers":[{"label":"Cupra","value":"102"}]}}]\n`);
}

export function lmDetailSeite(o: { transfer: number | null; zulassung: number | null | '{}'; anzahlung: number | '' }) {
  const reg = o.zulassung === '{}' ? '{}' : JSON.stringify(o.zulassung);
  const payload =
    `20:{"listing":{"id":13342515,"downpayment":${JSON.stringify(o.anzahlung)},"leasing":{"offers":[{"id":39185747,"leaseTotalAmount":4776,"duration":24,"includedMileage":10000,"monthlyRate":199,"monthlyNetRate":167.23,"leasingFactor":0.32,"listingRating":8.9},{"id":39185748,"duration":36,"includedMileage":10000,"monthlyRate":256,"monthlyNetRate":215.13,"leasingFactor":0.41,"listingRating":8.8}],` +
    `"bestOffer":{"id":39185747,"leaseTotalAmount":4776,"duration":24,"includedMileage":10000,"monthlyRate":199,"monthlyNetRate":167.23,"leasingFactor":0.32,"listingRating":8.9},"transferCosts":${JSON.stringify(o.transfer)},"registrationCosts":${reg},"isTradeInPossible":false,"refundForLessDistancePerKm":4.4,"additionalDistanceCostPerKm":10,"bank":"SEAT Bank/Leasing, Braunschweig","hasVWBank":true,"listingSource":"lm","envBonusPayment":0},"adFee":105.5,"description":"230-V-Steckdose {Kofferraum}"}}\n`;
  return nextSeite(payload, 2);
}

const item = (o: { titel: string; link: string; haendler: string; preis: string; beschreibung: string; datum: string }) => `<item>
<category><![CDATA[Auto & Motorrad]]></category>
<pepper:merchant name="${o.haendler}" price="${o.preis}" />
<media:content medium="image" url="https://static.mydealz.de/x.jpg" width="1024" height="768"/>
<title><![CDATA[${o.titel}]]></title>
<description><![CDATA[<strong>${o.preis} - ${o.haendler}</strong><br/>${o.beschreibung}]]></description>
<link>${o.link}?utm_source=rss</link>
<pubDate>${o.datum}</pubDate>
<guid>${o.link}</guid>
</item>`;

export const MD_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:pepper="http://www.pepper.com/rss">
<channel><title>mydealz – Auto-Leasing</title>
${item({
  titel: 'Privatleasing CUPRA Leon Sportstourer VZ 2.0 TSI 4Drive (333 PS, Allrad, DSG) für eff. 345,25€ mtl. (GF: 0,58)',
  link: 'https://www.mydealz.de/deals/privatleasing-cupra-leon-sportstourer-vz-20-tsi-4drive-333-ps-2862900',
  haendler: '9drive',
  preis: '8.286€',
  beschreibung: 'CUPRA Leon Sportstourer VZ im Privatleasing: die Konditionen<br/>Das Angebot im Überblick<br/>Monatsrate: 279,00 €<br/>Laufzeit: 24 Monate<br/>Bruttolistenpreis: 59.540 €',
  datum: 'Wed, 04 Nov 2026 16:55:32 +0100',
})}
${item({
  titel: '[Gewerbe] Cupra Leon Sportstourer VZ 2.0 TSI 4Drive (333 PS, DSG) für 99 € netto/Monat – effektiv 157 € netto, 24 Monate',
  link: 'https://www.mydealz.de/deals/gewerbe-cupra-leon-sportstourer-vz-2862800',
  haendler: 'Mister-Leasing',
  preis: '3.766€',
  beschreibung: 'Gewerbekunden können den Cupra Leon Sportstourer VZ mit 333 PS leasen.<br/>Den Preis gibt es nur mit Loyalisierungsprämie.',
  datum: 'Tue, 03 Nov 2026 12:45:00 +0100',
})}
${item({
  titel: '[Privatleasing]VW Volkswagen Golf GTI Black Style inkl. Sonderausstattung|sofort verfügbar|199€/M|LF 0,37|24M|10.000km/Jahr|1.200€ ÜF',
  link: 'https://www.mydealz.de/deals/privatleasingvw-volkswagen-golf-gti-black-style-2862711',
  haendler: 'Null-Leasing.com',
  preis: '5.976€',
  beschreibung: 'Bei Scherer bekommt ihr den VW Golf GTI im Privatleasing.<br/>Leistung<br/>195 kW (265 PS)<br/>Verfügbarkeit<br/>Sofort',
  datum: 'Tue, 03 Nov 2026 09:19:11 +0100',
})}
${item({
  titel: 'Gewerbeleasing: VW Taigo R-Line DSG, 116 PS, Black Style, 158,82 € netto mtl., eff. 190 €',
  link: 'https://www.mydealz.de/deals/gewerbeleasing-vw-taigo-2862500',
  haendler: 'Autohaus',
  preis: '4.560€',
  beschreibung: 'Taigo',
  datum: 'Tue, 03 Nov 2026 08:00:00 +0100',
})}
${item({
  titel: '[Privatleasing] BMW 220i Gran Coupé | 266€ mtl. | 24 Mo. | 10.000 km p.a. | 1.395€ ÜF | LF 0,62',
  link: 'https://www.mydealz.de/deals/bmw-220i-gran-coupe-2862400',
  haendler: 'Sixt',
  preis: '7.779€',
  beschreibung: 'BMW 2er',
  datum: 'Mon, 02 Nov 2026 10:00:00 +0100',
})}
</channel></rss>`;

export const MD_DEAL_ABGELAUFEN = `<html><body><nav>Privat Alarm setzen</nav><div class="thread"><span>Dieser Deal ist vor 2d abgelaufen</span><span class="vote">1132°</span><h1>VW Golf GTI</h1></div><script>var x = "45°";</script></body></html>`;
export const MD_DEAL_JSON = `<html><body><script>window.__INITIAL_STATE__={"thread":{"threadId":"2862711","commentCount":60,"isExpired":true}};</script><div><span class="vote">1132°</span><div>Leider ist dieser Deal mittlerweile abgelaufen</div></div></body></html>`;
export const MD_DEAL_AKTIV = `<html><body><div class="thread"><span class="vote">412°</span><h1>Cupra Leon</h1><p>Gepostet vor 3 h</p></div></body></html>`;
