import app from '@/app';
import { config } from '@/config/index';

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`Server is running in ${config.nodeEnv} mode on port ${PORT}`);
});
