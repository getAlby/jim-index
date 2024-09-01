// Import the package
import NDK, {
  NDKEvent,
  NDKKind,
  NDKNip07Signer,
  NDKSigner,
  NDKSubscription,
  NDKUser,
} from "@nostr-dev-kit/ndk";
import { create } from "zustand";
import { JIM_INSTANCE_KIND } from "./types";

// disable Alby getRelays
if (window.nostr) {
  window.nostr.getRelays = undefined;
}

// TODO: do not create signer on startup as it launches dialog
// Create a new NDK instance with explicit relays
export const ndk = new NDK({
  // TODO: review relays
  explicitRelayUrls: [
    "wss://relay.damus.io",
    "wss://eden.nostr.land",
    "wss://nos.lol",
    "wss://nostr.wine",
    "wss://relay.notoshi.win",
    "wss://lunchbox.sandwich.farm",
    "wss://nostr.stakey.net",
    "wss://relay.n057r.club",
  ],
});

type Jim = {
  url: string;
  eventId: string;
  event: NDKEvent;
  recommendedByUsers: { user: NDKUser; mutual: boolean }[];
  info: {
    name?: string;
    description?: string;
    image?: string;
  };
  reserves: {
    numChannels: number;
    totalOutgoingCapacity: number;
    totalChannelCapacity: number;
    numApps: number;
    totalAppBalance: number;
    hasPublicChannels: boolean;
  };
};

type Store = {
  readonly _jims: Partial<Jim>[];
  readonly jims: Jim[];
  readonly isLoggedIn: boolean;
  readonly hasLoaded: boolean;
  updateJim(jim: Partial<Jim>): void;
  setLoaded(hasLoaded: boolean): void;
  login(): Promise<boolean>;
};

export const useStore = create<Store>((set, get) => ({
  isLoggedIn: false,
  _jims: [],
  jims: [],
  hasLoaded: false,
  updateJim: (jim: Partial<Jim>) => {
    const currentJims = get()._jims;
    const currentJim: Partial<Jim> =
      currentJims.find((current) => current.eventId === jim.eventId) || {};

    const updatedJim: Partial<Jim> = {
      ...currentJim,
      ...jim,
      recommendedByUsers: [
        ...(currentJim.recommendedByUsers || []),
        ...(jim.recommendedByUsers || []),
      ].filter(
        (v, i, a) =>
          a.findIndex((current) => current.user.npub === v.user.npub) === i,
      ),
    };

    const _jims = [
      ...currentJims.filter((current) => current.eventId !== jim.eventId),
      updatedJim,
    ];
    const jims = _jims.filter((jim) => !!jim.info) as Jim[];
    const recommendedUsersFilter = (user: { mutual: boolean }) =>
      !ndk.signer || user.mutual;
    jims.sort(
      (a, b) =>
        b.recommendedByUsers.filter(recommendedUsersFilter).length -
        a.recommendedByUsers.filter(recommendedUsersFilter).length,
    );

    set({ _jims, jims });
  },
  setLoaded: (hasLoaded) => set({ hasLoaded }),
  login: async () => {
    if (get().isLoggedIn || !get().hasLoaded) {
      return get().isLoggedIn;
    }
    set({ hasLoaded: false });
    const signer = new NDKNip07Signer();
    ndk.signer = signer;
    await loadJims();
    await loadMutualRecommendations(signer);
    set({
      isLoggedIn: true,
      hasLoaded: true,
    });
    return true;
  },
}));

(async () => {
  console.log("Connecting to relays");
  await ndk.connect(5000);
  console.log("Loading Jims");
  await loadJims();
  useStore.getState().setLoaded(true);
})();

let jimInstanceEventsSub: NDKSubscription | undefined;
let jimRecommendationEventsSub: NDKSubscription | undefined;
async function loadJims() {
  if (jimInstanceEventsSub) {
    jimInstanceEventsSub.stop();
  }
  console.log("Fetching jim instance events");
  jimInstanceEventsSub = ndk.subscribe({
    kinds: [JIM_INSTANCE_KIND as NDKKind],
  });

  jimInstanceEventsSub.on("event", async (event) => {
    if (
      useStore
        .getState()
        .jims.some((existing) => existing.eventId === event.id && existing.info)
    ) {
      // only update the event
      useStore.getState().updateJim({
        event,
        eventId: event.id,
      });
      return;
    }

    const url = event.dTag;
    if (url && !url.endsWith("/")) {
      let info: Jim["info"];
      try {
        const response = await fetch(new URL("/api/info", url));
        if (!response.ok) {
          throw new Error("non-ok response");
        }
        info = await response.json();
      } catch (error) {
        console.error("failed to fetch jim info", url, error);
        return;
      }
      let reserves: Jim["reserves"];
      try {
        const response = await fetch(new URL("/api/reserves", url));
        if (!response.ok) {
          throw new Error("non-ok response");
        }
        reserves = await response.json();
      } catch (error) {
        console.error("failed to fetch jim reserves", url, error);
        return;
      }

      const jim: Partial<Jim> = {
        eventId: event.id,
        url,
        event,
        info,
        reserves,
      };
      useStore.getState().updateJim(jim);
    }
  });

  // load recommendations

  if (jimRecommendationEventsSub) {
    jimRecommendationEventsSub.stop();
  }
  jimRecommendationEventsSub = ndk.subscribe({
    kinds: [38000],
    "#k": [JIM_INSTANCE_KIND.toString()],
  });

  jimRecommendationEventsSub.on("event", (recommendationEvent: NDKEvent) => {
    const jimEventId = recommendationEvent.dTag;
    useStore.getState().updateJim({
      eventId: jimEventId,
      recommendedByUsers: [
        {
          user: recommendationEvent.author,
          mutual: false,
        },
      ],
    });
  });
}

async function loadMutualRecommendations(signer: NDKSigner) {
  console.log("fetching user...");
  const user = await signer.user();
  console.log("user", user);
  const follows = await user.follows();
  console.log("follows", follows);
  const followsPubkeys = [...Array.from(follows), user].map(
    (follow) => follow.pubkey,
  );
  const jims = useStore.getState().jims;
  for (const jim of jims) {
    for (const recommendedByUser of jim.recommendedByUsers) {
      if (followsPubkeys.includes(recommendedByUser.user.pubkey)) {
        recommendedByUser.mutual = true;
        await recommendedByUser.user.fetchProfile();
      }
    }
    useStore.getState().updateJim({
      eventId: jim.eventId,
      recommendedByUsers: jim.recommendedByUsers,
    });
  }

  useStore.getState().setLoaded(true);
}
