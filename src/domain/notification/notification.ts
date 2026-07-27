export type NotificationType = 'VACCINE_DELAYED' | 'APPOINTMENT_UPCOMING';

export interface NotificationProps {
  id: string;
  userId: string;
  babyId: string;
  type: NotificationType;
  referenceId: string;
  title: string;
  message: string;
  readAt: Date | null;
  createdAt: Date;
}

export interface CreateNotificationProps {
  id: string;
  userId: string;
  babyId: string;
  type: NotificationType;
  referenceId: string;
  title: string;
  message: string;
  createdAt?: Date;
}

export class Notification {
  readonly id: string;
  readonly userId: string;
  readonly babyId: string;
  readonly type: NotificationType;
  readonly referenceId: string;
  readonly title: string;
  readonly message: string;
  readonly readAt: Date | null;
  readonly createdAt: Date;

  private constructor(props: NotificationProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.babyId = props.babyId;
    this.type = props.type;
    this.referenceId = props.referenceId;
    this.title = props.title;
    this.message = props.message;
    this.readAt = props.readAt;
    this.createdAt = props.createdAt;
  }

  static create(props: CreateNotificationProps): Notification {
    return new Notification({
      id: props.id,
      userId: props.userId,
      babyId: props.babyId,
      type: props.type,
      referenceId: props.referenceId,
      title: props.title,
      message: props.message,
      readAt: null,
      createdAt: props.createdAt ?? new Date(),
    });
  }

  static restore(props: NotificationProps): Notification {
    return new Notification(props);
  }

  markAsRead(): Notification {
    return Notification.restore({
      id: this.id,
      userId: this.userId,
      babyId: this.babyId,
      type: this.type,
      referenceId: this.referenceId,
      title: this.title,
      message: this.message,
      readAt: new Date(),
      createdAt: this.createdAt,
    });
  }
}
