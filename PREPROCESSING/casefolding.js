const judul = "Simulator PEMROSESAN Citra Menggunakan+ Metode Konvolusi Untuk Gambar Yang Memiliki Noise Pada Desain Spanduk+pdf-_=)(*&^%$#@!<>/?\|";

function casefolding(judul) {
    const cleaned = judul
        .replace(/[^a-z0-9\s]/gi,"")
        .toLowerCase() //casefolding
        .split(/\s+/) //tokenizing
    console.log(cleaned)
    
    return cleaned;
}

casefolding(judul);