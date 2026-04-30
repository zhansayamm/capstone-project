import type { ReactNode } from "react";
import { Card, Layout } from "antd";

export function CenteredCard(props: { title?: ReactNode; children: ReactNode; width?: number }) {
  return (
    <Layout
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "linear-gradient(180deg, #f0f5ff 0%, #ffffff 45%)",
      }}
    >
      <Card
        title={props.title}
        style={{ width: props.width ?? 420, boxShadow: "0 10px 30px rgba(0,0,0,0.06)" }}
      >
        {props.children}
      </Card>
    </Layout>
  );
}

