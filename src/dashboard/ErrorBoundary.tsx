import { Component, type ReactNode } from "react";
import { t } from "../i18n";

type Props = { children: ReactNode; resetKey: string };
type State = { error: Error | null };

/** 表示中の例外で画面全体が真っ白にならないようにする。resetKey（タブ）が変われば表示し直す */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidUpdate(prev: Props): void {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="space-y-3 rounded-xl bg-red-100 px-4 py-3 text-red-900 dark:bg-red-950 dark:text-red-100">
        <p>{t("error.render", { message: this.state.error.message })}</p>
        <button type="button" className="underline" onClick={() => this.setState({ error: null })}>
          {t("error.retry")}
        </button>
      </div>
    );
  }
}
