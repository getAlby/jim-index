import { NDKEvent } from "@nostr-dev-kit/ndk";
import { useStore } from "./store";
import { JIM_INSTANCE_KIND } from "./types";

export default function App() {
  const store = useStore();

  async function addJim() {
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
      if (!confirm("Confirm publish new Jim: " + url)) {
        return;
      }
    } catch (error) {
      alert("Invalid URL: " + error);
      return;
    }
    const event = new NDKEvent(store.ndk);
    event.kind = JIM_INSTANCE_KIND;
    event.dTag = jimUrl.toString();

    try {
      const publishedRelays = await event.publish(undefined, undefined, 1);

      alert(
        "Published to " +
          Array.from(publishedRelays)
            .map((relay) => relay.url)
            .join(", "),
      );
    } catch (error) {
      alert("Publish failed: " + error);
    }
  }

  async function recommend(eventId: string) {
    const event = new NDKEvent(store.ndk);
    event.kind = 38000;
    event.tags.push(["k", JIM_INSTANCE_KIND.toString()]);
    event.dTag = eventId;
    try {
      if (!confirm("Confirm publish recommendation for event " + eventId)) {
        return;
      }
      const publishedRelays = await event.publish(undefined, undefined, 1);
      alert(
        "Published to " +
          Array.from(publishedRelays)
            .map((relay) => relay.url)
            .join(", "),
      );
    } catch (error) {
      alert("Publish failed: " + error);
    }
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <img src="/jim-index/jim-sm.png" className="w-12 h-12" />
          Jim Index
        </div>
        <div className="flex items-center justify-end gap-2">
          {!store.hasLoaded && (
            <span className="loading loading-spinner loading-md"></span>
          )}
          <button onClick={addJim} className="btn btn-primary">
            Add Jim
          </button>
        </div>
      </div>

      <div className="gap-4 grid grid-cols-1 md:flex">
        {store.jims.map((jim) => (
          <div key={jim.url} className="card bg-base-100 w-96 shadow-xl">
            <div className="card-body">
              <div className="flex items-center gap-2">
                <div className="avatar">
                  <div className="w-12 rounded-lg">
                    <img
                      src={
                        jim.info?.image ||
                        `https://api.dicebear.com/9.x/pixel-art/svg?seed=${jim.url}`
                      }
                    />
                  </div>
                </div>
                <h2 className="card-title line-clamp-1">
                  <a
                    href={jim.url}
                    target="_blank"
                    className="w-full font-semibold line-clamp-1"
                  >
                    {jim.info?.name || "Unknown Jim"}
                  </a>
                </h2>
              </div>
              <p className="text-sm line-clamp-2" title={jim.info?.description}>
                {jim.info?.description || "No description"}
              </p>
              <p>
                <a href={jim.url} target="_blank" className="link">
                  {jim.url}
                </a>
              </p>
              <p className="text-sm">
                {jim.recommendedByUsers.length} recommendations (
                {jim.recommendedByUsers.filter((r) => r.mutual).length} mutual)
              </p>
              <div className="card-actions justify-end mt-2">
                <a
                  href={jim.url}
                  target="_blank"
                  className="btn btn-primary btn-sm"
                >
                  Launch
                </a>
                <button
                  onClick={() => recommend(jim.eventId)}
                  className="btn btn-secondary btn-sm"
                >
                  Recommend
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
