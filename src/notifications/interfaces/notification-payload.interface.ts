export interface NotificationPayload {
  id: string;
  type:
    | 'user.created'
    | 'job.completed'
    | 'job.failed'
    | 'system.alert'
    | 'document.uploaded'
    | 'document.processing'
    | 'document.ready'
    | 'chat.new'
    | 'chat.message';
  title: string;
  message: string;
  metadata?: Record<string, any>;
  createdAt: string;
}
