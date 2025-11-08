const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTkbyjy0mm-DEBQ4dTqrB1MHz2aPQv5Gz-GISsuvf1_yQwA4D6xI_AxUZj55xBNg8qoUtbfc_vfHB5-/pub?output=csv';
let thesisData = [];

// ==================== UTILITY FUNCTIONS ====================

// Fungsi untuk mengambil parameter URL
function getUrlParameter(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

// Fungsi untuk mengkonversi Google Drive link ke embed URL
function convertDriveLink(url) {
    if (!url) return '';
    const match = url.match(/\/d\/([^\/]+)/);
    if (match) {
        return `https://drive.google.com/file/d/${match[1]}/preview`;
    }
    return url;
}

// ==================== TEXT PROCESSING ====================

// Preprocessing teks
function preprocessText(text) {
    return text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 0);
}

// Hitung TF (Term Frequency)
function calculateTF(words) {
    const tf = {};
    const totalWords = words.length;
    
    words.forEach(word => {
        tf[word] = (tf[word] || 0) + 1;
    });
    
    Object.keys(tf).forEach(word => {
        tf[word] = tf[word] / totalWords;
    });
    
    return tf;
}

// Hitung IDF (Inverse Document Frequency)
function calculateIDF(allDocuments) {
    const idf = {};
    const totalDocs = allDocuments.length;
    
    const docCount = {};
    allDocuments.forEach(doc => {
        const uniqueWords = [...new Set(doc)];
        uniqueWords.forEach(word => {
            docCount[word] = (docCount[word] || 0) + 1;
        });
    });
    
    Object.keys(docCount).forEach(word => {
        idf[word] = Math.log(totalDocs / docCount[word]);
    });
    
    return idf;
}

// Hitung TF-IDF
function calculateTFIDF(tf, idf) {
    const tfidf = {};
    Object.keys(tf).forEach(word => {
        tfidf[word] = tf[word] * (idf[word] || 0);
    });
    return tfidf;
}

// Hitung Cosine Similarity
function cosineSimilarity(vec1, vec2) {
    const allKeys = new Set([...Object.keys(vec1), ...Object.keys(vec2)]);
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;
    
    allKeys.forEach(key => {
        const val1 = vec1[key] || 0;
        const val2 = vec2[key] || 0;
        dotProduct += val1 * val2;
        mag1 += val1 * val1;
        mag2 += val2 * val2;
    });
    
    if (mag1 === 0 || mag2 === 0) return 0;
    return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
}

// Cari kata-kata yang sama
function findMatchingWords(inputWords, comparedWords) {
    const inputSet = new Set(inputWords);
    const comparedSet = new Set(comparedWords);
    return [...inputSet].filter(word => comparedSet.has(word));
}

// ==================== DATA LOADING ====================

// Load data dari spreadsheet
async function fetchSpreadsheetData() {
    const loadStatus = document.getElementById('loadStatus');
    const checkBtn = document.getElementById('checkBtn');
    
    try {
        const response = await fetch(SPREADSHEET_URL);
        if (!response.ok) {
            throw new Error('Gagal mengambil data dari spreadsheet');
        }
        
        const text = await response.text();
        
        // Gunakan PapaParse untuk parsing CSV yang lebih akurat
        Papa.parse(text, {
            header: false,
            skipEmptyLines: true,
            complete: function(results) {
                const rows = results.data;
                
                // Skip header row (index 0)
                thesisData = rows.slice(1)
                    .filter(row => row.length >= 5 && row[0])
                    .map(row => ({
                        judul: row[0] || '',
                        nim: row[1] || '',
                        tahun: row[2] || '',
                        penulis: row[3] || '',
                        file: row[4] || '',
                    }));
                
                if (thesisData.length === 0) {
                    throw new Error('Tidak ada data yang ditemukan');
                }
                
                loadStatus.innerHTML = `<p class="text-green-700 text-sm">✓ ${thesisData.length} data berhasil dimuat</p>`;
                loadStatus.className = 'mb-6 p-4 bg-green-50 border border-green-200 rounded-lg';
                checkBtn.disabled = false;
            },
            error: function(error) {
                throw new Error('Error parsing CSV: ' + error.message);
            }
        });
        
    } catch (err) {
        loadStatus.innerHTML = `<p class="text-red-700 text-sm">✗ ${err.message}</p>`;
        loadStatus.className = 'mb-6 p-4 bg-red-50 border border-red-200 rounded-lg';
        checkBtn.disabled = true;
    }
}

// ==================== SIMILARITY CALCULATION ====================

// Hitung kemiripan
function calculateSimilarity() {
    const inputTitle = document.getElementById('inputTitle').value;
    const errorMsg = document.getElementById('errorMsg');
    const resultsContainer = document.getElementById('resultsContainer');
    const resultsList = document.getElementById('resultsList');
    
    if (!inputTitle.trim()) {
        errorMsg.querySelector('p').textContent = 'Masukkan judul yang ingin diperiksa';
        errorMsg.classList.remove('hidden');
        resultsContainer.classList.add('hidden');
        return;
    }

    if (thesisData.length === 0) {
        errorMsg.querySelector('p').textContent = 'Data belum berhasil dimuat';
        errorMsg.classList.remove('hidden');
        resultsContainer.classList.add('hidden');
        return;
    }

    errorMsg.classList.add('hidden');
    
    // Preprocessing
    const inputWords = preprocessText(inputTitle);
    const allDocuments = [inputWords, ...thesisData.map(t => preprocessText(t.judul))];
    
    // Hitung IDF untuk semua dokumen
    const idf = calculateIDF(allDocuments);
    
    // Hitung TF-IDF untuk input
    const inputTF = calculateTF(inputWords);
    const inputTFIDF = calculateTFIDF(inputTF, idf);
    
    // Hitung similarity dengan setiap judul
    const similarities = thesisData.map(thesis => {
        const thesisWords = preprocessText(thesis.judul);
        const thesisTF = calculateTF(thesisWords);
        const thesisTFIDF = calculateTFIDF(thesisTF, idf);
        
        const similarity = cosineSimilarity(inputTFIDF, thesisTFIDF);
        const matchingWords = findMatchingWords(inputWords, thesisWords);
        
        return {
            ...thesis,
            similarity: similarity * 100,
            matchingWords: matchingWords
        };
    });
    
    // Sort berdasarkan similarity tertinggi
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    // Tampilkan top 10 hasil
    const top10 = similarities.slice(0, 10);
    
    resultsList.innerHTML = top10.map((result, index) => {
        const colorClass = result.similarity >= 70 ? 'text-red-600' :
                           result.similarity >= 40 ? 'text-yellow-600' : 'text-green-600';
        
        const detailUrl = `detail.html?judul=${encodeURIComponent(result.judul)}`;
        
        return `
        <a href="${detailUrl}" class="block group">
            <div class="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
                <div class="flex items-start justify-between mb-3">
                    <div class="flex-1">
                        <h3 class="font-semibold text-gray-800 mb-2 group-hover:text-indigo-600 transition-colors cursor-pointer">
                            ${result.judul}
                        </h3>
                        <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                            <span>Penulis: ${result.penulis}</span>
                            <span>NIM: ${result.nim}</span>
                            <span>Tahun: ${result.tahun}</span>
                        </div>
                    </div>
                    <div class="ml-4 text-right">
                        <div class="text-2xl font-bold ${colorClass}">
                            ${result.similarity.toFixed(1)}%
                        </div>
                        <div class="text-xs text-gray-500">Kemiripan</div>
                    </div>
                </div>
                ${result.matchingWords.length > 0 ? `
                    <div class="mt-3 pt-3 border-t border-gray-100">
                        <p class="text-sm text-gray-600 mb-2">Kata yang sama:</p>
                        <div class="flex flex-wrap gap-2">
                            ${result.matchingWords.map(word => 
                                `<span class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">${word}</span>`
                            ).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        </a>
        `;
    }).join('');
    
    resultsContainer.classList.remove('hidden');
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ==================== DETAIL PAGE ====================

// Load detail thesis
async function loadThesisDetail() {
    const judulParam = getUrlParameter('judul');
    
    if (!judulParam) {
        document.getElementById('detailTitle').textContent = 'Data tidak ditemukan';
        return;
    }

    try {
        const response = await fetch(SPREADSHEET_URL);
        if (!response.ok) {
            throw new Error('Gagal mengambil data dari spreadsheet');
        }
        
        const text = await response.text();
        
        Papa.parse(text, {
            header: false,
            skipEmptyLines: true,
            complete: function(results) {
                const rows = results.data;
                
                // Cari data yang sesuai dengan judul
                const data = rows.slice(1).find(row => 
                    row[0] && row[0].trim() === decodeURIComponent(judulParam).trim()
                );

                if (data && data.length >= 4) {
                    // Update informasi
                    document.getElementById('detailTitle').textContent = data[0] || 'N/A';
                    
                    document.getElementById('detailPenulis').innerHTML = `
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
                        </svg>
                        ${data[3] || 'N/A'}
                    `;
                    
                    document.getElementById('detailJurusan').innerHTML = `
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z"/>
                        </svg>
                        ${data[2] || 'N/A'}
                    `;
                    
                    document.getElementById('detailTahun').innerHTML = `
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>
                        </svg>
                        ${data[1] || 'N/A'}
                    `;
                    
                    // PDF Viewer (kolom index 6)
                    if (data[4] && data[4].trim()) {
                        const embedUrl = convertDriveLink(data[4]);
                        document.getElementById('pdfViewer').src = embedUrl;
                        document.getElementById('pdfLink').href = data[4];
                    } else {
                        document.getElementById('pdfContainer').innerHTML = '<p class="text-gray-500 text-center py-8">Dokumen tidak tersedia</p>';
                    }
                } else {
                    document.getElementById('detailTitle').textContent = 'Data tidak ditemukan';
                }
            },
            error: function(error) {
                console.error('Error parsing CSV:', error);
                document.getElementById('detailTitle').textContent = 'Error memuat data';
            }
        });
    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('detailTitle').textContent = 'Error memuat data';
    }
}

// ==================== INITIALIZATION ====================

// Initialize untuk halaman index
function initIndexPage() {
    // Load data saat halaman dimuat
    window.addEventListener('DOMContentLoaded', fetchSpreadsheetData);
    
    // Event listener untuk button
    document.getElementById('checkBtn').addEventListener('click', calculateSimilarity);
    
    // Enter key untuk submit
    document.getElementById('inputTitle').addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && e.ctrlKey) {
            calculateSimilarity();
        }
    });
}

// Initialize untuk halaman detail
function initDetailPage() {
    window.addEventListener('DOMContentLoaded', loadThesisDetail);
}

// Auto-detect halaman dan initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        if (document.getElementById('inputTitle')) {
            initIndexPage();
        } else if (document.getElementById('detailTitle')) {
            initDetailPage();
        }
    });
} else {
    if (document.getElementById('inputTitle')) {
        initIndexPage();
    } else if (document.getElementById('detailTitle')) {
        initDetailPage();
    }
}