"use client";

import { useActionState, useState } from "react";
import {
  createOrRotateTripShareLink,
  revokeTripShareLink,
  updateTripShareSettings,
  type TripShareActionState
} from "@/lib/actions/trip-sharing";
import type { TripShareNameMode, TripShareStatus } from "@/lib/trip-sharing";

type TripShareControlsProps = {
  tripId: string;
  linkStatus: TripShareStatus | null;
  participantNameMode: TripShareNameMode;
};

const initialTripShareActionState: TripShareActionState = { status: "idle" };

function SettingsFields({ participantNameMode }: { participantNameMode: TripShareNameMode }) {
  return (
    <>
      <div>
        <label className="label" htmlFor="participantNameMode">
          Participant names
        </label>
        <select
          className="field"
          defaultValue={participantNameMode}
          id="participantNameMode"
          name="participantNameMode"
        >
          <option value="anonymized">Anonymized labels (safest)</option>
          <option value="initials">Initials</option>
          <option value="first_name">First names</option>
          <option value="full_name">Full names</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="expiry">
          Link expiration
        </label>
        <select className="field" defaultValue="30" id="expiry" name="expiry">
          <option value="7">7 days from now</option>
          <option value="30">30 days from now (recommended)</option>
          <option value="90">90 days from now</option>
          <option value="never">No expiration; valid until revoked</option>
        </select>
      </div>
    </>
  );
}

function ActionMessage({ state }: { state: TripShareActionState }) {
  if (!state.message) return null;
  return (
    <p
      className={state.status === "error" ? "text-sm text-coral" : "text-sm text-ocean"}
      role="status"
    >
      {state.message}
    </p>
  );
}

export function TripShareControls({
  tripId,
  linkStatus,
  participantNameMode
}: TripShareControlsProps) {
  const [copyLabel, setCopyLabel] = useState("Copy sharing link");
  const [createState, createAction, createPending] = useActionState(
    createOrRotateTripShareLink.bind(null, tripId),
    initialTripShareActionState
  );
  const [settingsState, settingsAction, settingsPending] = useActionState(
    updateTripShareSettings.bind(null, tripId),
    initialTripShareActionState
  );
  const [revokeState, revokeAction, revokePending] = useActionState(
    revokeTripShareLink.bind(null, tripId),
    initialTripShareActionState
  );
  const hasCurrentLink = linkStatus !== null && linkStatus !== "revoked";

  async function copyShareUrl() {
    if (!createState.shareUrl) return;
    await navigator.clipboard.writeText(createState.shareUrl);
    setCopyLabel("Copied");
  }

  return (
    <div className="grid min-w-0 gap-5">
      <section className="card p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-ink">
          {hasCurrentLink ? "Rotate sharing link" : "Create sharing link"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Anyone with the link can view the configured cost summary without signing in and can
          forward it to others. SeddleUp stores only a protected digest, so the full link is shown
          only immediately after creation or rotation.
        </p>
        <form className="mt-4 grid gap-4" action={createAction}>
          <SettingsFields participantNameMode={participantNameMode} />
          <button
            className={`${hasCurrentLink ? "btn-danger" : "btn-primary"} w-full whitespace-normal`}
            data-testid="trip-share-create-or-rotate"
            disabled={createPending}
            onClick={(event) => {
              if (
                hasCurrentLink &&
                !window.confirm(
                  "Rotate this link? The current sharing link will stop working immediately."
                )
              ) {
                event.preventDefault();
              }
            }}
            type="submit"
          >
            {createPending
              ? "Saving..."
              : hasCurrentLink
                ? "Rotate and invalidate current link"
                : "Create read-only sharing link"}
          </button>
          <ActionMessage state={createState} />
        </form>
        {createState.shareUrl ? (
          <div
            className="mt-4 rounded-lg border border-line bg-surface p-4"
            data-testid="share-url"
          >
            <label className="label" htmlFor="generatedShareUrl">
              New sharing URL
            </label>
            <input
              className="field font-mono text-base sm:text-xs"
              id="generatedShareUrl"
              readOnly
              value={createState.shareUrl}
            />
            <button
              className="btn-secondary mt-3 w-full sm:w-auto"
              onClick={copyShareUrl}
              type="button"
            >
              {copyLabel}
            </button>
          </div>
        ) : null}
      </section>

      {hasCurrentLink ? (
        <section className="card p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-ink">Update sharing settings</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Saving an expiration replaces the current expiration with the selected period from now.
            The bearer token remains unchanged.
          </p>
          <form className="mt-4 grid gap-4" action={settingsAction}>
            <SettingsFields participantNameMode={participantNameMode} />
            <button className="btn-secondary w-full" disabled={settingsPending} type="submit">
              {settingsPending ? "Saving..." : "Save sharing settings"}
            </button>
            <ActionMessage state={settingsState} />
          </form>
        </section>
      ) : null}

      {hasCurrentLink ? (
        <section className="card border-red-100 p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-ink">Revoke sharing</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Revocation takes effect immediately. Recipients will see the same unavailable page used
            for invalid or expired links.
          </p>
          <form className="mt-4 grid gap-3" action={revokeAction}>
            <button
              className="btn-danger w-full"
              data-testid="trip-share-revoke"
              disabled={revokePending}
              onClick={(event) => {
                if (
                  !window.confirm("Revoke this sharing link? It will stop working immediately.")
                ) {
                  event.preventDefault();
                }
              }}
              type="submit"
            >
              {revokePending ? "Revoking..." : "Revoke sharing link"}
            </button>
            <ActionMessage state={revokeState} />
          </form>
        </section>
      ) : null}
    </div>
  );
}
