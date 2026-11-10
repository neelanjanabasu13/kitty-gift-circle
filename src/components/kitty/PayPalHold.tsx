import { useEffect, useRef, useState } from "react";
import { getPayPalClientId } from "@/lib/kitty.functions";

declare global {
  interface Window {
    paypal?: any;
  }
}

let sdkPromise: Promise<void> | null = null;
function loadSdk(clientId: string, currency: string) {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${currency}&intent=authorize&components=buttons&enable-funding=card&disable-funding=paylater,venmo`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      sdkPromise = null;
      reject(new Error("PayPal didn't load. Check your connection and refresh."));
    };
    document.head.appendChild(s);
  });
  return sdkPromise;
}

export function PayPalHold({
  currency,
  disabled,
  createOrder,
  onApproved,
  onError,
}: {
  currency: string;
  disabled?: boolean;
  createOrder: () => Promise<string>;
  onApproved: (orderId: string) => Promise<void>;
  onError: (msg: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "unconfigured" | "error">("loading");
  const handlers = useRef({ createOrder, onApproved, onError });
  handlers.current = { createOrder, onApproved, onError };

  useEffect(() => {
    let cancelled = false;
    let buttons: any;
    (async () => {
      try {
        const { clientId } = await getPayPalClientId();
        if (!clientId) return setState("unconfigured");
        await loadSdk(clientId, currency);
        if (cancelled || !ref.current || !window.paypal) return;
        buttons = window.paypal.Buttons({
          style: { layout: "vertical", shape: "pill", color: "gold", label: "paypal", height: 48 },
          createOrder: async () => {
            try {
              return await handlers.current.createOrder();
            } catch (e) {
              handlers.current.onError(e instanceof Error ? e.message : "We couldn't start the hold.");
              throw e;
            }
          },
          onApprove: async (data: { orderID: string }) => {
            try {
              await handlers.current.onApproved(data.orderID);
            } catch (e) {
              handlers.current.onError(e instanceof Error ? e.message : "The hold didn't go through. Nothing was taken.");
            }
          },
          onCancel: () => handlers.current.onError("No worries, nothing was held. Try again when you're ready."),
          onError: () => handlers.current.onError("PayPal hit a snag. Nothing was held, so please try again."),
        });
        ref.current.innerHTML = "";
        await buttons.render(ref.current);
        if (!cancelled) setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
      try {
        buttons?.close?.();
      } catch {
        /* noop */
      }
    };
  }, [currency]);

  return (
    <div className="relative">
      {state === "loading" && (
        <div className="space-y-2" aria-label="Loading PayPal">
          <div className="h-12 rounded-full shimmer" />
          <div className="h-12 rounded-full shimmer" />
        </div>
      )}
      {state === "unconfigured" && (
        <p className="rounded-2xl bg-held-soft p-4 text-sm text-foreground">PayPal isn't connected yet, so holds are paused for now. Please check back soon.</p>
      )}
      {state === "error" && (
        <p className="rounded-2xl bg-held-soft p-4 text-sm text-foreground">PayPal didn't load. Check your connection and refresh the page.</p>
      )}
      <div ref={ref} className={disabled ? "pointer-events-none opacity-40 transition-opacity" : "transition-opacity"} />
    </div>
  );
}
