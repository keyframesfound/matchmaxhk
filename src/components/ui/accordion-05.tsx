import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

export type Accordion05Item = {
  id: string;
  title: string;
  content: string;
};

export function Accordion05({
  items,
  defaultValue,
  className,
}: {
  items: Accordion05Item[];
  defaultValue?: string;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-3xl", className)}>
      <Accordion type="single" defaultValue={defaultValue} collapsible className="w-full">
        {items.map((item) => (
          <AccordionItem value={item.id} key={item.id} className="last:border-b">
            <AccordionTrigger className="text-left pl-6 md:pl-14 overflow-hidden text-foreground/20 duration-200 hover:no-underline cursor-pointer -space-y-6 data-[state=open]:space-y-0 data-[state=open]:text-primary [&>svg]:hidden">
              <div className="flex flex-1 items-start gap-4">
                <p className="text-xs">{item.id}</p>
                <h3 className="uppercase relative text-center text-3xl md:text-5xl">
                  {item.title}
                </h3>
              </div>
            </AccordionTrigger>

            <AccordionContent className="text-muted-foreground pb-6 pl-6 md:px-20">
              {item.content}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
