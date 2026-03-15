const imageInput = document.getElementById('imageInput');
const watermarkText = document.getElementById('watermarkText');
const fontFamily = document.getElementById('fontFamily');
const watermarkColor = document.getElementById('watermarkColor');
const fontSizeInput = document.getElementById('fontSize');
const fontOpacityInput = document.getElementById('fontOpacity');
const fontWeightInput = document.getElementById('fontWeight');
const fontStyleCheck = document.getElementById('fontStyle');
const customFontUrl = document.getElementById('customFontUrl');
const loadCustomFontBtn = document.getElementById('loadCustomFontBtn');
const posX = document.getElementById('posX');
const posY = document.getElementById('posY');
const downloadBtn = document.getElementById('downloadBtn');
const canvasWrapper = document.getElementById('canvasWrapper');
const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const shortcutBtns = document.querySelectorAll('.shortcut-btn');

// 摇杆控制元素
const joystickBase = document.getElementById('joystickBase');
const joystickStick = document.getElementById('joystickStick');

let currentImage = null;

// 初始化监听器
function initEventListeners() {
    imageInput.addEventListener('change', handleImageUpload);
    
    // 输入或修改属性时实时重新绘制
    const inputsToWatch = [watermarkText, fontFamily, watermarkColor, fontSizeInput, fontOpacityInput, fontWeightInput, fontStyleCheck, posX, posY];
    inputsToWatch.forEach(input => {
        input.addEventListener('input', drawCanvas);
    });

    // 快捷按钮监听器
    shortcutBtns.forEach(btn => {
        btn.addEventListener('click', handleShortcutUpdate);
    });

    initJoystick(); // 组装摇杆监听器
    loadCustomFontBtn.addEventListener('click', handleCustomFontLoad);
    downloadBtn.addEventListener('click', downloadImage);
}

// 处理图片上传
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            currentImage = img;
            
            // 首次加载设定画布大小为图片真实按比例显示
            canvas.width = img.width;
            canvas.height = img.height;
            
            // 移除空状态类名，显示Canvas
            canvasWrapper.classList.remove('empty');
            
            // 默认定位到图片中心
            posX.value = Math.floor(canvas.width / 2);
            posY.value = Math.floor(canvas.height / 2);

            drawCanvas();
            downloadBtn.disabled = false; // 启用下载按钮
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

// 加载自定义 Google Fonts 链接
async function handleCustomFontLoad() {
    const url = customFontUrl.value.trim();
    if (!url) return;

    // 解析字体名。常见的 Google Fonts 链接格式类似 `family=Roboto:wght@400`
    const match = url.match(/family=([^&:]+)/);
    if (!match) {
        alert('无法从链接中解析出字体名称，请确认链接是以 Google Fonts 标准格式导入的（如含有 family=... 字段）。');
        return;
    }

    // 处理带加号或者 URI 编码的情况
    let parsedFontName = decodeURIComponent(match[1].replace(/\+/g, ' '));

    // 动态添加 stylesheet
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    document.head.appendChild(link);

    // 将自定义字体加入下拉菜单
    let optionExists = false;
    Array.from(fontFamily.options).forEach(opt => {
        if (opt.value === parsedFontName) optionExists = true;
    });

    if (!optionExists) {
        const newOption = document.createElement('option');
        newOption.value = parsedFontName;
        newOption.textContent = `自定义 (${parsedFontName})`;
        fontFamily.appendChild(newOption);
    }
    
    // 切换到用户所添加的新字体
    fontFamily.value = parsedFontName;

    const btnText = loadCustomFontBtn.innerText;
    loadCustomFontBtn.innerText = '加载中...';
    
    // 等待网页字体 API 确认字体加载完成再绘画
    try {
        await document.fonts.load(`1em "${parsedFontName}"`);
        drawCanvas();
    } catch (e) {
        console.error('字体可能加载失败或者网页不支持该字体 API 检测', e);
        drawCanvas(); // 依然尝试最后绘制一次防御机制
    } finally {
        loadCustomFontBtn.innerText = btnText;
    }
}

// 摇杆核心交互逻辑
function initJoystick() {
    let isDragging = false;
    let baseRect;
    
    const handleDown = (e) => {
        isDragging = true;
        baseRect = joystickBase.getBoundingClientRect();
        moveStick(e);
        // 为了防止拖拽时选中文字或图片带来异常
        e.preventDefault();
    };
    
    const handleMove = (e) => {
        if (!isDragging) return;
        moveStick(e);
    };
    
    const handleUp = () => {
        isDragging = false;
        // 回弹摇杆
        joystickStick.style.transform = `translate(-50%, -50%)`;
    };
    
    const moveStick = (e) => {
        if (!currentImage) return;

        // 支持鼠标或触摸
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        if (clientX === undefined) return;

        const centerX = baseRect.left + baseRect.width / 2;
        const centerY = baseRect.top + baseRect.height / 2;
        
        let dx = clientX - centerX;
        let dy = clientY - centerY;
        
        // 限制摇杆范围（半径约束）
        const radius = baseRect.width / 2 - joystickStick.offsetWidth / 2;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > radius) {
            dx = (dx / distance) * radius;
            dy = (dy / distance) * radius;
        }

        // 修改摇杆外观
        joystickStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

        // 映射偏移向量到画布：我们建立摇动摇杆等于持续控制坐标的机制。
        // 为了更快的敏感度，给摇动乘以一个加速度。
        let currentPosX = parseInt(posX.value) || 0;
        let currentPosY = parseInt(posY.value) || 0;
        
        // 一次触发移动的像素距离（敏感度倍率）可以根据画布动态适配体验更佳
        // 降低灵敏度，提升精细控制的手感
        const sensitivity = Math.max(0.5, canvas.width / 1200) * 0.4; 
        
        currentPosX += dx * sensitivity;
        currentPosY += dy * sensitivity;

        // 防止文字飞出边界太多
        currentPosX = Math.max(0, Math.min(canvas.width, currentPosX));
        currentPosY = Math.max(0, Math.min(canvas.height, currentPosY));

        posX.value = Math.floor(currentPosX);
        posY.value = Math.floor(currentPosY);
        
        drawCanvas();
    };

    // 绑定鼠标事件
    joystickBase.addEventListener('mousedown', handleDown);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    
    // 绑定支持移动端触摸事件
    joystickBase.addEventListener('touchstart', handleDown, {passive: false});
    document.addEventListener('touchmove', handleMove, {passive: false});
    document.addEventListener('touchend', handleUp);
}

// 核心画布绘制逻辑
function drawCanvas() {
    if (!currentImage) return;

    // 清空重绘
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制底层照片
    ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);

    // 获取水印设置参数
    const text = watermarkText.value;
    const font = fontFamily.value;
    const color = watermarkColor.value;
    const x = parseInt(posX.value) || 0;
    const y = parseInt(posY.value) || 0;

    // 设置字体样式 (组合：斜体开关 字重 字号 字体名)
    const sizePercent = parseInt(fontSizeInput.value) || 5;
    const fontSize = Math.max(10, Math.floor(canvas.height * (sizePercent / 100)));
    const weight = fontWeightInput.value || '600';
    const italicStyle = fontStyleCheck.checked ? 'italic' : 'normal';
    
    ctx.font = `${italicStyle} ${weight} ${fontSize}px '${font}', sans-serif`;
    ctx.fillStyle = color;
    
    // 为了更好的可读性，给水印加上淡淡阴影和边缘轮廓
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // 获取并设置独立的透明度（0-100滑块映射为0.0-1.0）
    const opacityValue = parseInt(fontOpacityInput.value);
    ctx.globalAlpha = isNaN(opacityValue) ? 1.0 : opacityValue / 100;

    // 设置对齐方式，保证坐标(x, y)可以代表文本中心
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 绘制水印
    ctx.fillText(text, x, y);
    
    // 恢复全局Alpha、阴影设置，避免影响下一次（虽然每次都会清空重绘）
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    // 更新快捷按钮的高亮显示
    updateActiveShortcutBtn();
}

// 处理快捷位置按钮点击
function handleShortcutUpdate(e) {
    if (!currentImage) return;
    
    const posType = e.target.dataset.pos;
    const marginX = canvas.width * 0.05; // 5%的边缘宽余
    const marginY = canvas.height * 0.05;

    switch (posType) {
        case 'top-left':
            posX.value = marginX;
            posY.value = marginY;
            break;
        case 'top-center':
            posX.value = canvas.width / 2;
            posY.value = marginY;
            break;
        case 'top-right':
            posX.value = canvas.width - marginX;
            posY.value = marginY;
            break;
        case 'center-left':
            posX.value = marginX;
            posY.value = canvas.height / 2;
            break;
        case 'center':
            posX.value = canvas.width / 2;
            posY.value = canvas.height / 2;
            break;
        case 'center-right':
            posX.value = canvas.width - marginX;
            posY.value = canvas.height / 2;
            break;
        case 'bottom-left':
            posX.value = marginX;
            posY.value = canvas.height - marginY;
            break;
        case 'bottom-center':
            posX.value = canvas.width / 2;
            posY.value = canvas.height - marginY;
            break;
        case 'bottom-right':
            posX.value = canvas.width - marginX;
            posY.value = canvas.height - marginY;
            break;
    }
    
    // 强制触发一次重绘
    drawCanvas();
}

// 更新快捷按钮状态（高亮）
function updateActiveShortcutBtn() {
    shortcutBtns.forEach(btn => btn.classList.remove('active'));
}

// 下载处理逻辑
async function downloadImage() {
    if (!currentImage) return;

    const dataUrl = canvas.toDataURL('image/png', 1.0);

    // 提供对 Electron 原生打包环境的侦别与特殊分发交互
    if (window.electronAPI && window.electronAPI.saveImage) {
        try {
            const result = await window.electronAPI.saveImage(dataUrl);
            if (result && result.success) {
                console.log('图片原生保存成功：', result.filePath);
            }
        } catch (error) {
            console.error('保存原图出现错误：', error);
        }
    } else {
        // 如果并非运行在桌面环境中，仍然回退降级为生成临时 link 的传统浏览器下载
        const link = document.createElement('a');
        link.download = `watermark_${new Date().getTime()}.png`;
        link.href = dataUrl;
        link.click();
    }
}

// 页面加载完成后调用
document.addEventListener('DOMContentLoaded', initEventListeners);
