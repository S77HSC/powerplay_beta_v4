"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      setUser(user);

      if (user) {
        const { data } = await supabase
          .from("players")
          .select("*")
          .eq("auth_id", user.id)
          .single();
        setPlayer(data);
      }

      setLoading(false);
    };

    init();
  }, []);

  return (
    <AuthContext.Provider value={{ user, player, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);