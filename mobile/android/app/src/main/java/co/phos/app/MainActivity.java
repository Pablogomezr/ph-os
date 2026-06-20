package co.phos.app;

import android.os.Bundle;
import android.webkit.CookieManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Clerk (auth) usa un dominio distinto al de la app
        // (*.clerk.accounts.dev vs ph-os-build.vercel.app) para sincronizar
        // la sesión. El WebView de Android bloquea cookies de terceros por
        // defecto, lo que rompe el login dentro de la app nativa aunque
        // funcione normal en Chrome/Safari. Hay que habilitarlas a mano.
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(this.getBridge().getWebView(), true);
    }
}
