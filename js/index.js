// 1. Config ข้อมูลจริงของเตอร์
const SUPABASE_URL = 'https://jzjlgxfhdegvtwljkqaq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6amxneGZoZGVndnR3bGprcWFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2NzE4ODAsImV4cCI6MjA4MzI0Nzg4MH0.WVG1vqgsEEQf49QEhCAOB4htY_nKOt-NBSUDAdAyVKQ';
const LIFF_ID = '1657774688-OlBR5yr7';

let currentLat = 0;
let currentLng = 0;
let userData = null;

// 2. เริ่มต้นระบบ LINE LIFF
async function initLIFF() {
    try {
        await liff.init({ liffId: LIFF_ID });
        if (liff.isLoggedIn()) {
            const profile = await liff.getProfile();
            userData = profile;
            document.getElementById('userName').innerText = `คุณ ${profile.displayName}`;
            // ดึงรูปโปรไฟล์ LINE มาแสดงเป็นโลโก้ชั่วคราว
            document.getElementById('companyLogo').src = profile.pictureUrl; 
        } else {
            liff.login();
        }
    } catch (err) {
        console.error('LIFF Error:', err);
    }
}

// 3. ระบบจัดการกล้อง
const video = document.getElementById('video');
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        video.srcObject = stream;
    } catch (err) {
        alert("กรุณาอนุญาตให้เข้าถึงกล้อง");
    }
}

// 4. ระบบดึงพิกัด GPS
function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition((pos) => {
            currentLat = pos.coords.latitude;
            currentLng = pos.coords.longitude;
            document.getElementById('locationStatus').innerHTML = `📍 พิกัดปัจจุบัน: ${currentLat.toFixed(4)}, ${currentLng.toFixed(4)}`;
            document.getElementById('locationStatus').className = "bg-green-50 border border-green-200 p-3 rounded-lg mb-4 text-xs text-green-700";
        });
    }
}

// 5. ฟังก์ชัน Upload รูปไป Supabase Storage
async function uploadToSupabase(base64Image) {
    const fileName = `${userData.userId}_${Date.now()}.jpg`;
    const base64Data = base64Image.split(',')[1];
    const blob = await fetch(`data:image/jpeg;base64,${base64Data}`).then(res => res.blob());

    const response = await fetch(`${SUPABASE_URL}/storage/v1/object/checkin-photos/${fileName}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'image/jpeg'
        },
        body: blob
    });
    return fileName;
}

// 6. ฟังก์ชันบันทึกเวลา (Main Action)
async function handleClockAction(type) {
    if (!userData) return alert("ไม่พบข้อมูลผู้ใช้งาน");
    
    const btn = type === 'IN' ? document.getElementById('btnIn') : document.getElementById('btnOut');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "กำลังบันทึก...";

    try {
        // ถ่ายภาพ
        const canvas = document.getElementById('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg', 0.6);

        // Upload รูป
        const photoName = await uploadToSupabase(imageData);
        const photoUrl = `${SUPABASE_URL}/storage/v1/object/public/checkin-photos/${photoName}`;

        // บันทึก Log ลง Database
        const response = await fetch(`${SUPABASE_URL}/rest/v1/check_in_logs`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: userData.userId, // ในขั้นตอนนี้ใช้ userId จาก LINE ไปก่อน
                check_type: type,
                lat: currentLat,
                lng: currentLng,
                photo_url: photoUrl,
                raw_location: document.getElementById('locationStatus').innerText
            })
        });

        if (response.ok) {
            alert(`ลงเวลา ${type === 'IN' ? 'เข้างาน' : 'ออกงาน'} สำเร็จ!`);
        }
    } catch (err) {
        alert("เกิดข้อผิดพลาด: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

// เริ่มต้นเมื่อโหลดหน้า
window.onload = () => {
    initLIFF();
    startCamera();
    getLocation();
    setInterval(() => {
        document.getElementById('currentTime').innerText = new Date().toLocaleTimeString('th-TH');
    }, 1000);
};
