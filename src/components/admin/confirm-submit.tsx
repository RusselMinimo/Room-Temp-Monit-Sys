'use client'

import { PropsWithChildren } from "react";
import { Button } from "@/components/ui/button";

interface ConfirmSubmitProps {
	message: string;
	action: (formData: FormData) => void | Promise<void>;
	label: string;
	variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
	size?: "default" | "sm" | "lg" | "icon";
	disabled?: boolean;
}

export function ConfirmSubmit(props: PropsWithChildren<ConfirmSubmitProps>) {
	const { message, action, label, variant = "default", size = "default", disabled } = props;
	return (
		<form
			action={action}
			onSubmit={(event) => {
				// Simple browser confirm; replace with a dialog if needed
				const ok = window.confirm(message);
				if (!ok) {
					event.preventDefault();
					event.stopPropagation();
				}
			}}
		>
			<Button type="submit" variant={variant} size={size} disabled={disabled}>
				{label}
			</Button>
		</form>
	);
}


