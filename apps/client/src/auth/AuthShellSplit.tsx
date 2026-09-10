import type { ReactNode } from "react";

import StitchAsset from "../stitch/components/StitchAsset";
import { PRODUCT_STITCH } from "../stitch/product-registry";
import { AuthPrivacyFooter } from "./AuthPrivacyFooter";

/**
 * Split auth shell — the interactive stitch cloth fills the left half (md+),
 * the form sits on the right. Ported from mulyankan-frontend's AuthShellSplit
 * with the same registry-driven stitch asset and hover physics.
 */
export function AuthShellSplit({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-svh w-full flex-col overflow-hidden bg-tatva-surface-primary">
      <div className="m-tatva-4 flex min-h-0 flex-1 overflow-hidden rounded-tatva-sm bg-tatva-surface-secondary">
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
          <div className="relative hidden min-h-0 overflow-hidden md:block" aria-hidden>
            <StitchAsset
              id={PRODUCT_STITCH.authLogin}
              width={480}
              height={640}
              fill
              physics
              animate={false}
              physicsScale={3}
              className="absolute inset-0"
            />
          </div>

          <div className="flex min-h-0 flex-col overflow-y-auto px-tatva-10 py-tatva-6 md:p-tatva-8">
            <div className="flex flex-1 items-center justify-center">
              <div className="w-full max-w-[320px]">{children}</div>
            </div>

            <AuthPrivacyFooter />
          </div>
        </div>
      </div>
    </div>
  );
}
