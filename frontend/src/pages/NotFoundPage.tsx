import { Result, Button } from "antd";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <Result
      status="404"
      title="404"
      subTitle="Page not found."
      extra={
        <Button type="primary">
          <Link to="/">Go home</Link>
        </Button>
      }
    />
  );
}

