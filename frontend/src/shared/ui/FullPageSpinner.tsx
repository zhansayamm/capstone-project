import { Flex, Spin } from "antd";

export function FullPageSpinner() {
  return (
    <Flex style={{ minHeight: "60vh" }} align="center" justify="center">
      <Spin size="large" />
    </Flex>
  );
}

