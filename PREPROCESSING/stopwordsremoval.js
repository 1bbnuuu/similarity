const judul = "Simulator Pemrosesan Citra Menggunakan Metode Konvolusi Untuk Gambar Yang Memiliki Noise Pada Desain Spanduk";

async function getStopwords() {
  const gid = "1222777187";
  const baseUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTkbyjy0mm-DEBQ4dTqrB1MHz2aPQv5Gz-GISsuvf1_yQwA4D6xI_AxUZj55xBNg8qoUtbfc_vfHB5-/pub";
  const url = `${baseUrl}?gid=${gid}&single=true&output=csv`;

  const response = await fetch(url);
  const text = await response.text();

  const stopwords = text
    .split("\n")
    .map(w => w.trim().toLowerCase()) 
    .filter(w => w.length > 0);

  return stopwords;
}

function preprocessing(teks, stopwords) {
  let lower = teks.toLowerCase();

  let tokens = lower.replace(/[^\w\s]/g, "").split(/\s+/);

  let filtered = tokens.filter(token => !stopwords.includes(token));

  return filtered;
}

async function main() {
    const stopwords = await getStopwords();
    const hasil = preprocessing(judul, stopwords);
    console.log("stopword removal:", hasil);
}


// RAW
const rawjudul = "sistem pakar diagnosa penyakit pada anjing jenis herder dengan menggunakan metode forward chaining";

function tokenizing(teks) {
    const tokens = teks
        .replace(/[^\w\s]/g, "")
        .split(/\s+/);
    return tokens;
}

const hasilLower = rawjudul;
const tokens = tokenizing(hasilLower);

console.log("RAW:",tokens);
main();
