import { Layout } from "antd";
import type { ReactNode } from "react";

export function Page(props: { children: ReactNode }) {
  return (
    <Layout.Content style={{ padding: 24, maxWidth: 1200, margin: "0 auto", width: "100%" }}>
      {props.children}
    </Layout.Content>
  );
}

