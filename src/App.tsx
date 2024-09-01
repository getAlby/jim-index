import { getRelayListForUsers, NDKEvent } from "@nostr-dev-kit/ndk";
import { ndk, useStore } from "./store";
import { JIM_INSTANCE_KIND } from "./types";
import {
  Bitcoin,
  Droplets,
  ExternalLink,
  MicVocal,
  Router,
  SearchX,
  ThumbsUp,
  Wallet,
} from "lucide-react";
import React from "react";

export default function App() {
  const store = useStore();
  const [selectedJimUrl, setSelectedJimUrl] = React.useState<string>();

  async function login() {
    return store.login();
  }

  async function _publishToRelays(event: NDKEvent) {
    const user = await ndk.signer?.user();
    if (!user) {
      throw new Error("Could not fetch user");
    }
    const relayLists = await getRelayListForUsers([user.pubkey], ndk);
    const relayList = relayLists.get(user.pubkey);

    if (!relayList?.relays?.length) {
      throw new Error("User has no relays");
    }

    if (
      !confirm(
        "Confirm publish event " +
          JSON.stringify(event.rawEvent()) +
          " to relays " +
          relayList.relays.join(", "),
      )
    ) {
      throw new Error("user cancelled");
    }
    const publishedRelays = await event.publish(
      relayList.relaySet,
      undefined,
      1,
    );
    alert(
      "Published to " +
        Array.from(publishedRelays)
          .map((relay) => relay.url)
          .join(", "),
    );
  }

  async function addJim() {
    if (!(await login())) {
      alert("Failed to login");
      return;
    }
    const promptResponse = prompt("Enter your Jim URL");
    if (!promptResponse) {
      return;
    }
    let jimUrl: string;
    try {
      const url = new URL(promptResponse);
      jimUrl = url.toString();
      if (jimUrl.endsWith("/")) {
        jimUrl = jimUrl.substring(0, jimUrl.length - 1);
      }
    } catch (error) {
      alert("Invalid URL: " + error);
      return;
    }
    const event = new NDKEvent(ndk);
    event.kind = JIM_INSTANCE_KIND;
    event.dTag = jimUrl.toString();

    try {
      await _publishToRelays(event);
    } catch (error) {
      alert("Publish failed: " + error);
    }
  }

  async function recommend(eventId: string) {
    if (!(await login())) {
      alert("Failed to login");
      return;
    }
    const event = new NDKEvent(ndk);
    event.kind = 38000;
    event.tags.push(["k", JIM_INSTANCE_KIND.toString()]);
    event.dTag = eventId;
    try {
      await _publishToRelays(event);
    } catch (error) {
      alert("Publish failed: " + error);
    }
  }

  async function republish(event: NDKEvent) {
    if (!(await login())) {
      alert("Failed to login");
      return;
    }
    try {
      await _publishToRelays(event);
    } catch (error) {
      alert("Publish failed: " + error);
    }
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <img src="/jim-sm.png" className="w-12 h-12" />
          <span className="font-semibold">Uncle Jim Index</span>
        </div>
        <div className="flex items-center justify-end gap-2">
          {!store.hasLoaded && (
            <span className="loading loading-spinner loading-md"></span>
          )}
          {!store.isLoggedIn && store.hasLoaded && (
            <button onClick={login} className="btn btn-secondary">
              Login
            </button>
          )}
          <button onClick={addJim} className="btn btn-primary">
            Add Jim
          </button>
        </div>
      </div>

      <div className="gap-4 grid grid-cols-1 md:grid-cols-3 mt-8">
        {!store.jims.length &&
          [...new Array(9)].map((_, index) => (
            <div
              key={index}
              className="card bg-neutral-50/50 shadow-xl skeleton"
            >
              <div className="card-body">
                <div className="flex items-center gap-2">
                  <div className="avatar">
                    <div className="w-12 bg-neutral-50 rounded-lg skeleton"></div>
                  </div>
                  <h2 className="card-title bg-neutral-50 skeleton w-48 h-8"></h2>
                </div>
                <p className={"text-sm w-64 h-16"}></p>

                <div className="card-actions justify-end mt-2">
                  <div className="rounded-lg bg-neutral-50 skeleton w-16 h-6"></div>
                  <div className="rounded-lg bg-neutral-50 skeleton w-16 h-6"></div>
                  <div className="rounded-lg bg-neutral-50 skeleton w-16 h-6"></div>
                </div>
              </div>
            </div>
          ))}
        {store.jims.map((jim) => (
          <div key={jim.url} className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <div className="flex items-center gap-2">
                <div className="avatar">
                  <div className="w-12 rounded-lg">
                    <img
                      src={
                        jim.info.image ||
                        `https://api.dicebear.com/9.x/croodles-neutral/svg?seed=${jim.url}`
                      }
                    />
                  </div>
                </div>
                <div>
                  <h2 className="card-title line-clamp-1">
                    <a
                      href={jim.url}
                      target="_blank"
                      className="w-full font-semibold line-clamp-1"
                    >
                      {jim.info.name || "Unknown Jim"}
                    </a>
                  </h2>
                  <div className="flex flex-wrap gap-2 items-center mt-1">
                    <span
                      className="badge flex gap-2"
                      title={`${jim.reserves.numApps} hosted wallets with non-zero balances`}
                    >
                      <Wallet className="w-4" /> {jim.reserves.numApps}
                    </span>
                    <span
                      className="badge flex gap-2"
                      title={
                        Intl.NumberFormat().format(
                          Math.floor(jim.reserves.totalAppBalance / 1000),
                        ) + " sats on hosted wallets"
                      }
                    >
                      <Bitcoin className="w-4" />{" "}
                      {Intl.NumberFormat().format(
                        Math.floor(jim.reserves.totalAppBalance / 1000),
                      )}{" "}
                      sats
                    </span>
                    <span
                      className="badge flex gap-2"
                      title={
                        Intl.NumberFormat().format(
                          Math.floor(jim.reserves.totalChannelCapacity / 1000),
                        ) +
                        " sats capacity across " +
                        jim.reserves.numChannels +
                        " channels"
                      }
                    >
                      <Droplets className="w-4" />{" "}
                      {Intl.NumberFormat().format(
                        Math.floor(jim.reserves.totalChannelCapacity / 1000),
                      )}{" "}
                      sats
                    </span>
                    {jim.reserves.hasPublicChannels && (
                      <span className="badge flex gap-2">
                        <MicVocal className="w-4" />
                        {"podcasting ok"}
                      </span>
                    )}
                    {jim.reserves.totalAppBalance >
                      jim.reserves.totalOutgoingCapacity && (
                      <span
                        className="badge flex gap-2"
                        title={
                          Intl.NumberFormat().format(
                            Math.floor(
                              (jim.reserves.totalAppBalance -
                                jim.reserves.totalOutgoingCapacity) /
                                1000,
                            ),
                          ) + " sats uncounted for"
                        }
                      >
                        <SearchX className="w-4" />
                        {"reserves unmet"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <p
                className={`text-sm cursor-pointer ${selectedJimUrl !== jim.url && "line-clamp-2"}`}
                title={jim.info.description}
                onClick={() =>
                  setSelectedJimUrl((current) =>
                    current === jim.url ? undefined : jim.url,
                  )
                }
              >
                {jim.info.description || "No description"}
              </p>
              {!store.isLoggedIn && (
                <p className="text-xs">Login to see friend recommendations</p>
              )}
              {store.isLoggedIn && (
                <div className="flex flex-wrap gap-2">
                  {jim.recommendedByUsers
                    .filter((user) => user.mutual)
                    .map((user) => (
                      <a
                        key={user.user.pubkey}
                        href={`https://nostrudel.ninja/#/u/${user.user.npub}`}
                      >
                        <div className="avatar">
                          <div className="w-8 rounded-lg">
                            <img
                              title={
                                user.user.profile?.displayName ||
                                user.user.profile?.name ||
                                user.user.npub
                              }
                              src={
                                user.user.profile?.image ||
                                `https://api.dicebear.com/9.x/pixel-art/svg?seed=${user.user.pubkey}`
                              }
                            />
                          </div>
                        </div>
                      </a>
                    ))}
                </div>
              )}

              <div className="card-actions justify-end mt-2">
                <a
                  href={jim.url}
                  target="_blank"
                  className="btn btn-primary btn-sm"
                  title="Visit this Jim in a new tab"
                >
                  <ExternalLink className="w-4" />
                  Visit
                </a>
                <button
                  onClick={() => recommend(jim.eventId)}
                  className="btn btn-secondary btn-sm flex gap-2 items-center justify-center"
                  title="Recommend this relay"
                >
                  <ThumbsUp className="w-4" /> {jim.recommendedByUsers.length}
                </button>
                <button
                  onClick={() => republish(jim.event)}
                  className="btn btn-secondary btn-sm flex gap-2 items-center justify-center"
                  title={`Published on ${jim.event.onRelays.length} relays (${jim.event.onRelays.map((relay) => relay.url).join(", ")})`}
                >
                  <Router className="w-4" /> {jim.event.onRelays.length}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
