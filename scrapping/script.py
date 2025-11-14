import requests
from bs4 import BeautifulSoup
import csv
import time
from urllib.parse import urljoin
import re
import sys
import json
import os

if sys.platform == 'win32':
    import codecs
    sys.stdout.reconfigure(encoding='utf-8')

class PerpusScraper:
    def __init__(self, base_url="https://perpus.stmikplk.ac.id"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        self.data_list = []
        self.progress_file = 'scraping_progress.json'
    
    def get_page(self, url):
        """Mengambil halaman dengan error handling"""
        try:
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            return response.text
        except requests.RequestException as e:
            print(f"Error mengakses {url}: {e}")
            return None
    
    def extract_text(self, element):
        """Ekstrak teks dari element, return empty string jika None"""
        return element.get_text(strip=True) if element else ""
    
    def scrape_item_detail(self, item_url):
        """Scraping detail dari halaman item"""
        print(f"  Mengakses: {item_url}")
        html = self.get_page(item_url)
        if not html:
            return None
        
        soup = BeautifulSoup(html, 'html.parser')
        
        # Ambil NIM/Kode dari <p> sebelum <ul>
        nim_element = soup.find('p', style=lambda x: x and 'font-size: small' in x)
        nim = ""
        if nim_element:
            nim_text = self.extract_text(nim_element)
            # Bersihkan dari whitespace berlebih
            nim = ' '.join(nim_text.split())
        
        # Cari ul dengan style yang sesuai
        ul = soup.find('ul', style=lambda x: x and 'font-weight: bold' in x)
        if not ul:
            return None
        
        data = {'nim': nim}  # Tambahkan NIM di awal
        
        # Ekstrak setiap field
        for li in ul.find_all('li'):
            text = li.get_text(strip=True)
            
            if text.startswith('Judul :'):
                link = li.find('a')
                data['judul'] = self.extract_text(link) if link else text.replace('Judul :', '').strip()
            
            elif text.startswith('Pengarang :'):
                authors = [self.extract_text(a) for a in li.find_all('a')]
                data['pengarang'] = ', '.join(authors) if authors else text.replace('Pengarang :', '').strip()
            
            elif text.startswith('Penerbit :'):
                link = li.find('a')
                data['penerbit'] = self.extract_text(link) if link else text.replace('Penerbit :', '').strip()
            
            elif text.startswith('Klasifikasi :'):
                link = li.find('a')
                klasifikasi = self.extract_text(link) if link else text.replace('Klasifikasi :', '').strip()
                data['klasifikasi'] = klasifikasi
                
                # Filter: hanya ambil jika klasifikasi dimulai dengan "TA TI"
                if not klasifikasi.startswith('TA TI'):
                    print(f"    Dilewati - Klasifikasi: {klasifikasi}")
                    return None
            
            elif text.startswith('Call Number :'):
                data['call_number'] = text.replace('Call Number :', '').strip()
            
            elif text.startswith('Bahasa :'):
                link = li.find('a')
                data['bahasa'] = self.extract_text(link) if link else text.replace('Bahasa :', '').strip()
            
            elif text.startswith('Tahun :'):
                link = li.find('a')
                data['tahun'] = self.extract_text(link) if link else text.replace('Tahun :', '').strip()
            
            elif text.startswith('Halaman :'):
                link = li.find('a')
                data['halaman'] = self.extract_text(link) if link else text.replace('Halaman :', '').strip()
        
        return data
    
    def scrape_main_page(self, page_url):
        """Scraping halaman utama untuk mendapatkan link item"""
        print(f"\nMemproses halaman: {page_url}")
        html = self.get_page(page_url)
        if not html:
            return None
        
        soup = BeautifulSoup(html, 'html.parser')
        
        # Cari semua artikel item
        articles = soup.find_all('article', class_='item')
        print(f"Ditemukan {len(articles)} item di halaman ini")
        
        for article in articles:
            # Cari link ke detail item
            link = article.find('a', href=True)
            if link:
                item_url = urljoin(self.base_url, link['href'])
                
                # Scrape detail item
                item_data = self.scrape_item_detail(item_url)
                if item_data:
                    item_data['url'] = item_url
                    self.data_list.append(item_data)
                    print(f"    [OK] Data tersimpan: {item_data.get('judul', 'N/A')[:50]}...")
                
                # Delay untuk menghindari overload server
                time.sleep(1)
        
        # Cari link "Next" untuk pagination
        pagination = soup.find('div', class_='pagination')
        if pagination:
            next_link = pagination.find('a', class_='nextLink')
            if next_link and next_link.get('href'):
                return urljoin(self.base_url, next_link['href'])
        
        return None
    
    def save_progress(self, page_count, next_url, csv_filename):
        """Simpan progress scraping"""
        progress = {
            'page_count': page_count,
            'next_url': next_url,
            'total_data': len(self.data_list),
            'csv_filename': csv_filename
        }
        with open(self.progress_file, 'w', encoding='utf-8') as f:
            json.dump(progress, f, indent=2)
        print(f"Progress disimpan: Halaman {page_count}, Total data: {len(self.data_list)}")
    
    def load_progress(self):
        """Load progress scraping sebelumnya"""
        if os.path.exists(self.progress_file):
            with open(self.progress_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return None
    
    def load_existing_data(self, filename):
        """Load data yang sudah di-scrape sebelumnya"""
        if os.path.exists(filename):
            with open(filename, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                self.data_list = list(reader)
            print(f"Data sebelumnya dimuat: {len(self.data_list)} record")
        else:
            print("Tidak ada data sebelumnya")
    
    def scrape_all(self, start_url="/perpus/main", max_pages=None, resume=False, start_page=1, auto_mode=True, load_existing=True):
        """Scraping semua halaman dengan pagination
        
        Args:
            start_url: URL awal
            max_pages: Maksimal halaman yang akan di-scrape (None = semua)
            resume: Lanjutkan dari progress terakhir
            start_page: Mulai dari halaman ke-berapa (default: 1)
            auto_mode: Jika True, tidak perlu tekan Enter (default: True)
            load_existing: Jika True, otomatis load data CSV sebelumnya (default: True)
        """
        csv_filename = 'data_ta_ti.csv'
        
        # Cek apakah ingin melanjutkan scraping
        if resume:
            progress = self.load_progress()
            if progress:
                print(f"\n{'='*60}")
                print(f"MELANJUTKAN SCRAPING")
                print(f"{'='*60}")
                print(f"Halaman terakhir: {progress['page_count']}")
                print(f"Total data sebelumnya: {progress['total_data']}")
                print(f"URL berikutnya: {progress['next_url']}")
                
                # Load data yang sudah ada
                self.load_existing_data(progress['csv_filename'])
                
                # Mulai dari URL berikutnya
                current_url = progress['next_url']
                page_count = progress['page_count']
                csv_filename = progress['csv_filename']
                
                if not auto_mode:
                    input("\nTekan Enter untuk melanjutkan...")
            else:
                print("Tidak ada progress sebelumnya. Memulai dari awal.")
                current_url = urljoin(self.base_url, start_url)
                page_count = 0
        elif start_page > 1:
            # Mulai dari halaman tertentu
            # Rumus: offset = (page - 1) * 12 (karena 12 item per halaman)
            offset = (start_page - 1) * 12
            current_url = f"{self.base_url}/perpus/main/index?offset={offset}&max=12"
            page_count = start_page - 1
            
            print(f"\n{'='*60}")
            print(f"MEMULAI DARI HALAMAN {start_page}")
            print(f"{'='*60}")
            print(f"URL: {current_url}")
            
            # Load data sebelumnya jika ada
            if load_existing and os.path.exists(csv_filename):
                self.load_existing_data(csv_filename)
                print(f"Data sebelumnya dimuat dari {csv_filename}")
            
            if not auto_mode:
                input("\nTekan Enter untuk mulai scraping...")
        else:
            current_url = urljoin(self.base_url, start_url)
            page_count = 0
        
        try:
            while current_url:
                page_count += 1
                print(f"\n{'='*60}")
                print(f"Halaman {page_count}")
                print(f"{'='*60}")
                
                next_url = self.scrape_main_page(current_url)
                
                # Simpan progress setiap halaman
                if next_url:
                    self.save_progress(page_count, next_url, csv_filename)
                    # Auto-save data setiap halaman
                    self.save_to_csv(csv_filename)
                
                if max_pages and page_count >= max_pages:
                    print(f"\nBatas maksimal {max_pages} halaman tercapai")
                    break
                
                if not next_url:
                    print("\nTidak ada halaman berikutnya")
                    break
                
                current_url = next_url
                time.sleep(2)  # Delay antar halaman
        
        except KeyboardInterrupt:
            print("\n\nScraping dihentikan oleh user (Ctrl+C)")
            print(f"Progress disimpan. Gunakan resume=True untuk melanjutkan.")
            self.save_to_csv(csv_filename)
            return
        
        print(f"\n{'='*60}")
        print(f"Scraping selesai! Total data TA TI yang dikumpulkan: {len(self.data_list)}")
        print(f"{'='*60}")
        
        # Hapus progress file jika selesai
        if os.path.exists(self.progress_file):
            os.remove(self.progress_file)
            print("Progress file dihapus (scraping selesai)")
    
    def save_to_csv(self, filename='perpus_data.csv'):
        """Simpan data ke file CSV"""
        if not self.data_list:
            print("Tidak ada data untuk disimpan")
            return
        
        keys = ['nim', 'judul', 'pengarang', 'penerbit', 'klasifikasi', 'call_number', 
                'bahasa', 'tahun', 'halaman', 'url']
        
        with open(filename, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            writer.writerows(self.data_list)
        
        print(f"\nData berhasil disimpan ke {filename}")


if __name__ == "__main__":
    scraper = PerpusScraper()

    # PILIHAN 1: Scraping dari halaman 1-5
    # scraper.scrape_all(start_page=1, max_pages=5)
    
    scraper.scrape_all(start_page=5, max_pages=30, load_existing=True)

    # scraper.scrape_all()
    
    scraper.save_to_csv('data_ta_ti.csv')
    
    print(f"\n{'='*60}")
    print(f"RINGKASAN DATA")
    print(f"{'='*60}")
    print(f"Total data terkumpul: {len(scraper.data_list)} record")
    
    if len(scraper.data_list) > 0:
        print(f"\nContoh 3 data terakhir:")
        for i, data in enumerate(scraper.data_list[-3:], 1):
            print(f"\n{i}. {data.get('judul', 'N/A')[:60]}...")
            print(f"   NIM: {data.get('nim', 'N/A')}")
            print(f"   Pengarang: {data.get('pengarang', 'N/A')}")
            print(f"   Klasifikasi: {data.get('klasifikasi', 'N/A')}")
            print(f"   Tahun: {data.get('tahun', 'N/A')}")