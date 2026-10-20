'use client';
import { ErrorNotice } from '@/components/ui';
export default function ErrorPage({ reset }: { reset: () => void }) { return <ErrorNotice message="页面暂时无法加载。你的本地项目不会因此被删除，请重试。" onRetry={reset}/>; }
