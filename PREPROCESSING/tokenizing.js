const judul = "Simulator Pemrosesan Citra Menggunakan Metode Konvolusi Untuk Gambar Yang Memiliki Noise Pada Desain Spanduk";

function tokenizing(teks) {
    const tokens = teks
        .replace(/[^\w\s]/g, "") // hapus tanda baca (koma, titik, dsb)
        .split(/\s+/);            // pisah berdasarkan satu atau lebih spasi
    return tokens;
}

const hasilLower = judul;
const tokens = tokenizing(hasilLower);

console.log(tokens);
