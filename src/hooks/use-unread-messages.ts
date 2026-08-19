import { useSession } from "next-auth/react";
import { startTransition, useEffect, useState } from "react";

export function useUnreadMessages() {
  const { status } = useSession();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (status !== "authenticated") return;

    const load = () => {
      fetch("/api/conversations/unread-count")
        .then((res) => res.json())
        .then((body) => {
          startTransition(() => {
            setCount(body.data?.count ?? 0);
          });
        })
        .catch(() => {});
    };

    load();
    const interval = setInterval(load, 20_000);
    return () => clearInterval(interval);
  }, [status]);

  return count;
}
