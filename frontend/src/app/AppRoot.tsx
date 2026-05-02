import { RouterProvider } from "react-router-dom";
import { App as AntApp, ConfigProvider, theme } from "antd";

import { AuthBootstrap } from "./AuthBootstrap";
import { appRouter } from "./router/appRouter";
import { useAuthStore } from "../features/auth/store/useAuthStore";
import { setupApiClient } from "../shared/api";
import { setupDayjs } from "../shared/utils/dayjs";

setupDayjs();
setupApiClient(useAuthStore);

export function AppRoot() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: "#1677ff",
          borderRadius: 10,
        },
      }}
    >
      <AntApp>
        <AuthBootstrap />
        <RouterProvider router={appRouter} />
      </AntApp>
    </ConfigProvider>
  );
}

