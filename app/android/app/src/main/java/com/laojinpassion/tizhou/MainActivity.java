package com.laojinpassion.tizhou;

import android.webkit.ValueCallback;

import com.getcapacitor.BridgeActivity;

/**
 * 题舟原生壳。
 * 默认 Capacitor 的物理返回键会直接结束 Activity（=退出应用），
 * 这里先交给页面里的 window.__tizhouBack() 处理：页面能返回就返回，
 * 已经在首页才真正退出应用。
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onBackPressed() {
        if (getBridge() == null || getBridge().getWebView() == null) {
            MainActivity.super.onBackPressed();
            return;
        }
        getBridge().getWebView().evaluateJavascript(
                "(function(){try{return window.__tizhouBack?window.__tizhouBack():false}catch(e){return false}})()",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        if (!"true".equals(value)) {
                            MainActivity.super.onBackPressed();
                        }
                    }
                });
    }
}
