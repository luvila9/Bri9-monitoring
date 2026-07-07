package com.ubay.Bri9;

import android.content.Intent;
import android.net.Uri;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

public class BankNotificationListener extends NotificationListenerService {

    // ==========================================
    // KUNCI ANTI-SPAM (MENCEGAH DOUBLE DATA)
    // ==========================================
    private String lastSavedText = "";
    private long lastSavedTime = 0;

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn.getNotification().extras == null) return;

        String title = sbn.getNotification().extras.getString("android.title", "");
        String text = sbn.getNotification().extras.getCharSequence("android.text", "").toString();
        String lowerText = (title + " " + text).toLowerCase();

        boolean containsBank = lowerText.contains("seabank") || lowerText.contains("dana") ||
                lowerText.contains("gopay") || lowerText.contains("bca") ||
                lowerText.contains("mandiri") || lowerText.contains("livin") ||
                lowerText.contains("blu") || lowerText.contains("ovo") ||
                lowerText.contains("shopeepay") || lowerText.contains("brimo") ||
                lowerText.contains("jago");

        boolean containsMoney = lowerText.contains("rp") || lowerText.contains("idr") ||
                lowerText.contains("transfer") || lowerText.contains("top up") ||
                lowerText.contains("berhasil") || lowerText.contains("pembayaran");

        if (containsBank && containsMoney) {
            String fullText = title + " | " + text;
            long currentTime = System.currentTimeMillis();

            // LOGIKA ANTI-SPAM Bekerja di sini:
            // Jika teksnya sama persis dan jedanya kurang dari 10 detik (10000 ms), abaikan!
            if (fullText.equals(lastSavedText) && (currentTime - lastSavedTime) < 10000) {
                return;
            }

            // Simpan jejak notifikasi ini agar tidak kebobolan lagi
            lastSavedText = fullText;
            lastSavedTime = currentTime;

            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("bri9app://add?autoText=" + Uri.encode(fullText)));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

            try {
                startActivity(intent);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
}