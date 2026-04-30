import { Button, Card, Typography } from "antd";

import { calendarApi } from "../../shared/api";
import { downloadBlob } from "../../shared/utils/download";
import { Page } from "../../shared/ui/Page";

export function ProfessorCalendarExportPage() {
  return (
    <Page>
      <Typography.Title level={2} style={{ marginTop: 8 }}>
        Calendar export
      </Typography.Title>
      <Card>
        <Typography.Paragraph>
          Download your personal calendar as an <Typography.Text code>.ics</Typography.Text> file.
        </Typography.Paragraph>
        <Button
          type="primary"
          onClick={async () => {
            const blob = await calendarApi.downloadMyCalendarIcs();
            downloadBlob(blob, "booking-time.ics");
          }}
        >
          Download .ics
        </Button>
      </Card>
    </Page>
  );
}

