import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../services/firebase";
import { doc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { AuthContext } from "./auth-context";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        await setDoc(
          doc(db, "users", currentUser.uid),
          {
            email: currentUser.email || "",
            displayName: currentUser.displayName || "",
            emailVerified: currentUser.emailVerified,
            online: true,
            lastSeen: serverTimestamp(),
          },
          { merge: true }
        );

        setUser(currentUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Handle tab close / refresh
  useEffect(() => {
    const setPresence = async (online) => {
      if (!auth.currentUser) return;

      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        online,
        lastSeen: serverTimestamp(),
      });
    };

    const handleOffline = async () => {
      await setPresence(false);
    };

    const handleVisibilityChange = async () => {
      await setPresence(!document.hidden);
    };

    window.addEventListener("beforeunload", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {loading ? <div className="auth-loading">Checking session...</div> : children}
    </AuthContext.Provider>
  );
};
