'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { completeWhatsAppSignup } from '@/lib/actions/channels';

// Public config (inlined at build). The button only renders when both are set —
// otherwise the manual-connect path is the only WhatsApp option.
const APP_ID = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
const CONFIG_ID = process.env.NEXT_PUBLIC_WHATSAPP_CONFIG_ID;
const SDK_VERSION = process.env.NEXT_PUBLIC_WHATSAPP_API_VERSION ?? 'v21.0';

interface FBLoginResponse {
  authResponse?: { code?: string } | null;
}
interface FBSdk {
  init(params: Record<string, unknown>): void;
  login(cb: (r: FBLoginResponse) => void, opts: Record<string, unknown>): void;
}
declare global {
  interface Window {
    FB?: FBSdk;
    fbAsyncInit?: () => void;
  }
}

export function WhatsAppEmbeddedSignup({ agentId }: { agentId: string }) {
  const tw = useTranslations('settings.channels.whatsapp');
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [pending, start] = useTransition();
  // The WA_EMBEDDED_SIGNUP message carries the new phone-number / WABA ids; the
  // FB.login callback carries the auth code. We need both, so stash the ids here.
  const session = useRef<{ phoneNumberId?: string; wabaId?: string }>({});

  useEffect(() => {
    if (!APP_ID || !CONFIG_ID) return;

    const onMessage = (event: MessageEvent) => {
      try {
        if (!new URL(event.origin).hostname.endsWith('facebook.com')) return;
        const data = JSON.parse(event.data) as {
          type?: string;
          event?: string;
          data?: { phone_number_id?: string; waba_id?: string };
        };
        if (data.type === 'WA_EMBEDDED_SIGNUP' && data.event === 'FINISH') {
          session.current = { phoneNumberId: data.data?.phone_number_id, wabaId: data.data?.waba_id };
        }
      } catch {
        // non-JSON / cross-origin noise — ignore
      }
    };
    window.addEventListener('message', onMessage);

    if (window.FB) {
      setReady(true);
    } else {
      window.fbAsyncInit = () => {
        window.FB?.init({ appId: APP_ID, autoLogAppEvents: true, xfbml: false, version: SDK_VERSION });
        setReady(true);
      };
      if (!document.getElementById('facebook-jssdk')) {
        const js = document.createElement('script');
        js.id = 'facebook-jssdk';
        js.src = 'https://connect.facebook.net/en_US/sdk.js';
        js.async = true;
        js.defer = true;
        document.body.appendChild(js);
      }
    }
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (!APP_ID || !CONFIG_ID) return null;

  const launch = () => {
    if (!window.FB) return;
    session.current = {};
    window.FB.login(
      (response) => {
        const code = response?.authResponse?.code;
        const { phoneNumberId, wabaId } = session.current;
        if (!code || !phoneNumberId) {
          toast.error(tw('signupCancelled'));
          return;
        }
        start(async () => {
          const res = await completeWhatsAppSignup({ code, phoneNumberId, wabaId: wabaId ?? '', agentId });
          if (res.ok) {
            toast.success(tw('signupDone'));
            router.refresh();
          } else {
            toast.error(tw('signupFailed'));
          }
        });
      },
      {
        config_id: CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {}, featureType: '', sessionInfoVersion: '3' },
      }
    );
  };

  return (
    <div className="space-y-2">
      <Button type="button" onClick={launch} disabled={!ready || pending || !agentId} className="w-full gap-2">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
        {tw('signupCta')}
      </Button>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {tw('orManual')}
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
