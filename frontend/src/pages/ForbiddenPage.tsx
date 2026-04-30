import { Result, Button } from "antd";
import { Link } from "react-router-dom";

export function ForbiddenPage() {
  return (
    <Result
      status="403"
      title="403"
      subTitle="You don’t have access to this page."
      extra={
        <Button type="primary">
          <Link to="/">Go home</Link>
        </Button>
      }
    />
  );
}

