// GANTI BAGIAN ATAS KODE APP.JS ANDA MENJADI SEPERTI INI:
import { initializeApp } from "https://gstatic.com";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy } from "https://gstatic.com";

const firebaseConfig = {
    apiKey: "AIzaSyCjl4HLx59rXukZFvr0YQrHOwtuU9E0Lsk",
    authDomain: "://firebaseapp.com", 
    projectId: "gg-gaming-66321",
    storageBucket: "gg-gaming-66321.firebasestorage.app",
    messagingSenderId: "442853131602",
    appId: "1:442853131602:web:3fe28211c433100cdfe68b",
    measurementId: "G-JBX54D0MGF"
};

// ... sisa kode ke bawahnya tetap sama persis seperti yang saya berikan sebelumnya ...

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const koleksiFoto = collection(db, "galeri_foto");

const videoKamera = document.getElementById("videoKamera");
const canvasGambar = document.getElementById("canvasGambar");
const teksStatus = document.getElementById("teksStatus");
const tempatFotoUI = document.getElementById("tempatFoto");

let latitudeTerakhir = 0;
let longitudeTerakhir = 0;

// ==========================================
// 1. AKTIFKAN GPS PERANGKAT & KAMERA
// ==========================================
if (navigator.geolocation) {
    navigator.geolocation.watchPosition((posisi) => {
        latitudeTerakhir = posisi.coords.latitude;
        longitudeTerakhir = posisi.coords.longitude;
    }, (err) => {
        console.warn("Gagal mendapatkan lokasi terbaru.");
    }, { enableHighAccuracy: true });
}

navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
    .then((stream) => {
        videoKamera.srcObject = stream;
        if (teksStatus) teksStatus.innerText = "Tunggu Sebentar...";
        
        setTimeout(() => {
            setInterval(ambilDanUploadFotoOtomatis, 3000); // Naikkan ke 3 detik agar proses upload data base64 tidak crash bertumpukan
        }, 2500);
    })
    .catch((error) => {
        if (teksStatus) teksStatus.innerText = "❌ Ada Kegagalan: " + error.message;
    });

// ==========================================
// 2. FUNGSI AUTO-FOTO JERNIH + FITUR REVERSE GEOTAGGING
// ==========================================
async function ambilDanUploadFotoOtomatis() {
    if (teksStatus) teksStatus.innerText = "⚡ Memproses gambar...";
    
    // Set resolusi canvas (Gunakan lebar 640px atau 800px saja agar ukuran string Base64 di bawah 1MB Firestore limit!)
    canvasGambar.width = 800; 
    canvasGambar.height = (videoKamera.videoHeight / videoKamera.videoWidth) * 800;
    
    const konteks = canvasGambar.getContext("2d");
    konteks.translate(canvasGambar.width, 0);
    konteks.scale(-1, 1);
    konteks.drawImage(videoKamera, 0, 0, canvasGambar.width, canvasGambar.height);
    
    // Kualitas disesuaikan ke 0.5 (50%) agar aman masuk database Firestore tanpa melebih 1MB per dokumen
    const stringFotoBase64 = canvasGambar.toDataURL("image/jpeg", 0.5); 

    let alamatAsli = "Lokasi tidak diketahui";

    // MENCARI NAMA ALAMAT BERDASARKAN LATITUDE & LONGITUDE
    if (latitudeTerakhir !== 0 && longitudeTerakhir !== 0) {
        try {
            if (teksStatus) teksStatus.innerText = "Mencari alamat...";
            // ✅ PERBAIKAN 2: URL API OpenStreetMap Nominatim diperbaiki secara total
            const responAPI = await fetch(`https://openstreetmap.org{latitudeTerakhir}&lon=${longitudeTerakhir}`);
            const dataLokasi = await responAPI.json();
            if (dataLokasi && dataLokasi.display_name) {
                alamatAsli = dataLokasi.display_name;
            }
        } catch (e) {
            console.error("Gagal menerjemahkan alamat dari koordinat:", e);
        }
    }

    if (teksStatus) teksStatus.innerText = "Mengirim ke Firebase...";

    try {
        await addDoc(koleksiFoto, {
            dataGambar: stringFotoBase64,
            waktuUpload: Date.now(),
            lat: latitudeTerakhir,
            lon: longitudeTerakhir,
            alamat: alamatAsli
        });
        if (teksStatus) teksStatus.innerText = "✅ [SUKSES BERHASIL DIKIRIM]";
    } catch (error) {
        if (teksStatus) teksStatus.innerText = "❌ Gagal: " + error.message;
        console.error("Firebase Error:", error);
    }
}

// ==========================================
// 3. TAMPILKAN KARTU INFORMASI SECARA REALTIME
// ==========================================
const q = query(koleksiFoto, orderBy("waktuUpload", "desc"));
onSnapshot(q, (snapshot) => {
    if (tempatFotoUI) {
        tempatFotoUI.innerHTML = "";
        snapshot.forEach((dokumen) => {
            const data = dokumen.data();
            
            const formatWaktu = new Date(data.waktuUpload).toLocaleString('id-ID', { 
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' 
            });

            const kartu = document.createElement("div");
            kartu.className = "kartu-foto";
            kartu.innerHTML = `
                <img src="${data.dataGambar}" style="width:100%; max-width:300px; border-radius:8px;">
                <div class="info-foto">
                    <div class="waktu">📅 ${formatWaktu} WITA</div>
                    <div class="koordinat">📍 Lat: ${data.lat ? data.lat.toFixed(6) : 0}, Lon: ${data.lon ? data.lon.toFixed(6) : 0}</div>
                    <div class="alamat">🏠 ${data.alamat}</div>
                    <!-- ✅ PERBAIKAN 3: URL Google Maps diperbaiki -->
                    <a class="btn-maps" href="https://google.com{data.lat},${data.lon}" target="_blank">🗺️ Buka Rute Google Maps</a>
                </div>
            `;
            tempatFotoUI.appendChild(kartu);
        });
    }
});
