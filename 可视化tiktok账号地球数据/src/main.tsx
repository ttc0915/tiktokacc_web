import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';

const container = document.getElementById('root');
if (!container) {
	throw new Error('Root container #root not found');
}
const root = createRoot(container);
root.render(
	<React.StrictMode>
		<App />
	</React.StrictMode>
);

// Stagewise 开发工具集成（仅限开发模式）
if (import.meta.env.DEV) {
	console.log('[stagewise] 🔧 开发模式已启用');
	
	// 创建 stagewise 工具栏配置
	const stagewiseConfig = {
		plugins: []
	};
	
	// 异步初始化 Stagewise 工具栏
	(async () => {
		try {
			const { initToolbar } = await import('@stagewise/toolbar');
			initToolbar(stagewiseConfig);
			console.log('[stagewise] ✅ Stagewise 工具栏已成功初始化！');
			
			// 创建成功指示器
			const successIndicator = document.createElement('div');
			successIndicator.innerHTML = `
				<div style="
					position: fixed;
					top: 10px;
					right: 10px;
					background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
					color: white;
					padding: 8px 12px;
					border-radius: 20px;
					font-size: 12px;
					font-family: monospace;
					z-index: 9999;
					box-shadow: 0 2px 10px rgba(0,0,0,0.2);
					cursor: pointer;
					user-select: none;
				" title="Stagewise 工具栏已启用">
					🎯 STAGEWISE READY
				</div>
			`;
			
			successIndicator.onclick = () => {
				alert(`🎉 Stagewise 工具栏已成功集成！
		
✅ AI 辅助编辑功能已启用
✅ 可以选择页面元素进行编辑
✅ 支持智能代码生成
✅ 开发模式专用功能

💡 提示：选择页面中的任意元素，然后使用 Stagewise 工具栏进行 AI 辅助编辑。`);
			};
			
			document.body.appendChild(successIndicator);
			
		} catch (err) {
			console.error('[stagewise] ❌ 初始化失败:', err);
			
			// 创建错误指示器
			const errorIndicator = document.createElement('div');
			errorIndicator.innerHTML = `
				<div style="
					position: fixed;
					top: 10px;
					right: 10px;
					background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
					color: white;
					padding: 8px 12px;
					border-radius: 20px;
					font-size: 12px;
					font-family: monospace;
					z-index: 9999;
					box-shadow: 0 2px 10px rgba(0,0,0,0.2);
					cursor: pointer;
					user-select: none;
				" title="Stagewise 初始化失败">
					⚠️ STAGEWISE ERROR
				</div>
			`;
			
			errorIndicator.onclick = () => {
				const errorMessage = err instanceof Error ? err.message : String(err);
				alert(`❌ Stagewise 工具栏初始化失败

错误信息：${errorMessage}

可能的解决方案：
1. 确保已正确安装 @stagewise/toolbar 包
2. 检查网络连接
3. 重启开发服务器

🔧 如需帮助，请检查控制台日志。`);
			};
			
			document.body.appendChild(errorIndicator);
		}
	})();
}

