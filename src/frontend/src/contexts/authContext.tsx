import { createContext, useContext, useEffect, useState } from "react";
import Cookies from "universal-cookie";
import { autoLogin as autoLoginApi, getLoggedUser } from "../controllers/API";
import { Users } from "../types/api";
import { AuthContextType } from "../types/contexts/auth";
import { alertContext } from "./alertContext";

const initialValue: AuthContextType = {
  isAdmin: false,
  setIsAdmin: () => false,
  isAuthenticated: false,
  accessToken: null,
  refreshToken: null,
  login: () => {},
  logout: () => {},
  refreshAccessToken: () => Promise.resolve(),
  userData: null,
  setUserData: () => {},
  getAuthentication: () => false,
  authenticationErrorCount: 0,
  autoLogin: false,
  setAutoLogin: () => {},
};

export const AuthContext = createContext<AuthContextType>(initialValue);

export function AuthProvider({ children }): React.ReactElement {
  const cookies = new Cookies();
  const [accessToken, setAccessToken] = useState<string | null>(
    cookies.get("access_token")
  );
  const [refreshToken, setRefreshToken] = useState<string | null>(
    cookies.get("refresh_token")
  );
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [userData, setUserData] = useState<Users | null>(null);
  const [autoLogin, setAutoLogin] = useState<boolean>(false);
  const { setLoading } = useContext(alertContext);
  useEffect(() => {
    const storedAccessToken = cookies.get("access_token");
    if (storedAccessToken) {
      setAccessToken(storedAccessToken);
    }
  }, []);

  useEffect(() => {
    const isLoginPage = location.pathname.includes("login");

    autoLoginApi()
      .then((user) => {
        if (user && user["access_token"]) {
          user["refresh_token"] = "auto";
          login(user["access_token"], user["refresh_token"]);
          setUserData(user);
          setAutoLogin(true);
          setLoading(false);
        }
      })
      .catch((error) => {
        setAutoLogin(false);
        if (getAuthentication() && !isLoginPage) {
          getLoggedUser()
            .then((user) => {
              setUserData(user);
              setLoading(false);
              const isSuperUser = user.is_superuser;
              setIsAdmin(isSuperUser);
            })
            .catch((error) => {});
        } else {
          setLoading(false);
        }
      });
  }, []);

  function getAuthentication() {
    const storedRefreshToken = cookies.get("refresh_token");
    const storedAccess = cookies.get("access_token");
    const auth = storedAccess && storedRefreshToken ? true : false;
    return auth;
  }

  function login(newAccessToken: string, refreshToken: string) {
    cookies.set("access_token", newAccessToken, { path: "/" });
    cookies.set("refresh_token", refreshToken, { path: "/" });
    setAccessToken(newAccessToken);
    setRefreshToken(refreshToken);
    setIsAuthenticated(true);
  }

  function logout() {
    cookies.remove("access_token", { path: "/" });
    cookies.remove("refresh_token", { path: "/" });
    setIsAdmin(false);
    setUserData(null);
    setAccessToken(null);
    setRefreshToken(null);
    setIsAuthenticated(false);
  }

  async function refreshAccessToken(refreshToken: string) {
    try {
      const response = await fetch("/api/refresh-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        login(data.accessToken, refreshToken);
        getLoggedUser().then((user) => {
          console.log("oi");
        });
      } else {
        logout();
      }
    } catch (error) {
      logout();
    }
  }

  return (
    // !! to convert string to boolean
    <AuthContext.Provider
      value={{
        isAdmin,
        setIsAdmin,
        isAuthenticated: !!accessToken,
        accessToken,
        refreshToken,
        login,
        logout,
        refreshAccessToken,
        setUserData,
        userData,
        getAuthentication,
        authenticationErrorCount: 0,
        setAutoLogin,
        autoLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
